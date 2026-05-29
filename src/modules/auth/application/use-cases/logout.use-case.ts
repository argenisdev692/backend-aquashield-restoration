import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
 * Revoke the caller's CURRENT session. Idempotent — repeated calls succeed
 * without error. The access token still works until it expires (≤15 min);
 * the refresh token tied to this session is now useless.
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: IAuthSessionRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly events: EventEmitter2,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(LogoutUseCase.name);
  }

  async execute(userId: string, sessionId: string | undefined): Promise<void> {
    if (!sessionId) {
      // Legacy token without `sid` — revoke ALL sessions for safety.
      const revoked = await this.sessions.revokeAllForUser(userId);
      this.emit(userId, revoked);
      await this.audit.log({
        action: 'auth.logout',
        actorId: userId,
        resourceType: 'USER',
        resourceId: userId,
        metadata: { mode: 'all_legacy_token', count: revoked.length },
      });
      return;
    }

    await this.sessions.revokeById(sessionId);
    this.emit(userId, [sessionId]);
    await this.audit.log({
      action: 'auth.logout',
      actorId: userId,
      resourceType: 'AUTH_SESSION',
      resourceId: sessionId,
    });
    this.logger.info('Session revoked', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId,
      sessionId,
    });
  }

  private emit(userId: string, sessionIds: string[]): void {
    if (sessionIds.length === 0) return;
    this.events.emit(
      SessionRevokedEvent.name,
      new SessionRevokedEvent(userId, sessionIds, 'logout'),
    );
  }
}
