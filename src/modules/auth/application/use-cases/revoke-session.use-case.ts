import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { CLS_KEYS } from '../../../../shared/cls/cls.constants';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../../shared/activity-log/audit.port';
import {
  AUTH_SESSION_REPOSITORY,
  type IAuthSessionRepository,
} from '../../domain/ports/auth-session.repository.port';
import { SessionRevokedEvent } from '../../domain/events/session-revoked.event';

/**
 * Revoke a specific session by id. Ownership is enforced: only the user
 * the session belongs to may revoke it (an admin would use a separate
 * admin endpoint with CASL). Already-revoked sessions are a no-op.
 *
 * Audits `auth.session.revoked` and emits `SessionRevokedEvent` so the
 * listener writes the audit row with metadata.
 */
@Injectable()
export class RevokeSessionUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: IAuthSessionRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly events: EventEmitter2,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(RevokeSessionUseCase.name);
  }

  async execute(args: { userId: string; sessionId: string }): Promise<void> {
    const session = await this.sessions.findById(args.sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== args.userId) {
      // 404 (not 403) to avoid leaking which session ids exist for other users.
      throw new NotFoundException('Session not found');
    }
    if (session.isRevoked()) return;

    await this.sessions.revokeById(session.id!);

    this.events.emit(
      SessionRevokedEvent.name,
      new SessionRevokedEvent(args.userId, [session.id!], 'admin_revoke'),
    );

    await this.audit.log({
      action: 'auth.session.revoked_manually',
      actorId: args.userId,
      resourceType: 'AUTH_SESSION',
      resourceId: session.id!,
      metadata: {
        ipAddress: this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null,
      },
    });

    this.logger.info('Session revoked manually', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId: args.userId,
      sessionId: session.id,
    });
  }
}

