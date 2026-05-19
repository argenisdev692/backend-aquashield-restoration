import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type Observable, tap } from 'rxjs';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../shared/activity-log/audit.port';
import type { AuthenticatedUser } from '../access/actions.enum';
import { SKIP_AUDIT_KEY } from '../decorators/skip-audit.decorator';

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Generic HTTP-level audit for mutations. A coarse fallback —
 * business use cases still log specific `{module}.{verb}` actions.
 * Disabled per-route with `@SkipAudit()`.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    const skip = this.reflector.getAllAndOverride<boolean | undefined>(
      SKIP_AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skip || !MUTATION_METHODS.has(req.method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        void this.audit.log({
          action: `http.${req.method.toLowerCase()}`,
          actorId: req.user?.id,
          resourceId:
            typeof req.params?.id === 'string' ? req.params.id : undefined,
          metadata: {
            path: (req.route as { path?: string } | undefined)?.path ?? req.url,
          },
        });
      }),
    );
  }
}
