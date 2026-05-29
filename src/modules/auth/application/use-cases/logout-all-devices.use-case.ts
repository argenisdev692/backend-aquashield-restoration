import { Inject, Injectable } from '@nestjs/common';
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
 * Revoke every active session for the user. Optionally keeps the calling
 * session alive (`keepCurrent=true`) — mirrors "log out of all OTHER
 * devices" UX. Trusted-device cookies are NOT cleared here; the user
 * revokes those from the device-management UI.
 */
@Injectable()
export class LogoutAllDevicesUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: IAuthSessionRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly events: EventEmitter2,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(LogoutAllDevicesUseCase.name);
  }

  async execute(args: {
    userId: string;
    currentSessionId?: string;
    keepCurrent: boolean;
  }): Promise<{ revoked: number }> {
    const revoked = await this.sessions.revokeAllForUser(args.userId, {
      exceptSessionId: args.keepCurrent ? args.currentSessionId : undefined,
    });

    if (revoked.length > 0) {
      this.events.emit(
        SessionRevokedEvent.name,
        new SessionRevokedEvent(args.userId, revoked, 'logout_all'),
      );
    }

    await this.audit.log({
      action: 'auth.logout_all',
      actorId: args.userId,
      resourceType: 'USER',
      resourceId: args.userId,
      metadata: {
        revokedCount: revoked.length,
        keepCurrent: args.keepCurrent,
        ipAddress: this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null,
      },
    });

    this.logger.info('Logout all devices', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId: args.userId,
      revokedCount: revoked.length,
    });

    return { revoked: revoked.length };
  }
}
