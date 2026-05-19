import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type Observable, of, tap } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { CacheService } from '../../shared/cache/cache.service';
import type { AuthenticatedUser } from '../access/actions.enum';
import { CACHE_TTL_KEY } from '../decorators/cache-ttl.decorator';
import { SKIP_CACHE_KEY } from '../decorators/skip-cache.decorator';

/**
 * GET response caching. Active only when the handler declares `@CacheTTL()`;
 * bypassed by `@SkipCache()` or for any non-GET request. Cache key is scoped
 * per user so authorization-filtered responses never leak across principals.
 */
@Injectable()
export class CacheTtlInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cache: CacheService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    const skip = this.reflector.getAllAndOverride<boolean | undefined>(
      SKIP_CACHE_KEY,
      [context.getHandler(), context.getClass()],
    );
    const ttl = this.reflector.getAllAndOverride<number | undefined>(
      CACHE_TTL_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skip || !ttl || req.method !== 'GET') {
      return next.handle();
    }

    const key = `http:${req.user?.id ?? 'anon'}:${req.originalUrl}`;

    return of(null).pipe(
      switchMap(async () => this.cache.get<unknown>(key)),
      switchMap((cached) => {
        if (cached !== null) {
          return of(cached);
        }
        return next
          .handle()
          .pipe(tap((body) => void this.cache.set(key, body, ttl)));
      }),
    );
  }
}
