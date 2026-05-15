import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { type Observable, tap } from 'rxjs';
import { LoggerService } from '../../logger/logger.service';

/**
 * Per-handler timing log (complements pino-http's automatic request log
 * with controller-level duration + traceId at debug level).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.debug('Handler completed', {
            layer: 'http',
            method: req.method,
            path: req.url,
            durationMs: Date.now() - startedAt,
          }),
        error: () =>
          this.logger.warn('Handler errored', {
            layer: 'http',
            method: req.method,
            path: req.url,
            durationMs: Date.now() - startedAt,
          }),
      }),
    );
  }
}
