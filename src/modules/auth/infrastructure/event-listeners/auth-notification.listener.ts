import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../../../../logger/logger.service';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../../shared/activity-log/audit.port';
import {
  AUTH_EMAIL_SERVICE,
  type IAuthEmailService,
} from '../../domain/ports/auth-email.port';
import {
  USER_ACCOUNT_REPOSITORY,
  type IUserAccountRepository,
} from '../../domain/ports/user-account.repository.port';
import {
  AUTH_SESSION_REPOSITORY,
  type IAuthSessionRepository,
} from '../../domain/ports/auth-session.repository.port';
import { LoginFailedEvent } from '../../domain/events/login-failed.event';
import { LoginSucceededEvent } from '../../domain/events/login-succeeded.event';
import { NewDeviceDetectedEvent } from '../../domain/events/new-device-detected.event';
import { AccountLockedEvent } from '../../domain/events/account-locked.event';
import {
  SuspiciousActivityDetectedEvent,
  PasswordResetRequestedEvent,
  SocialAccountLinkedEvent,
} from '../../domain/events/suspicious-activity-detected.event';
import { PasswordChangedEvent } from '../../domain/events/password-changed.event';
import {
  TwoFactorEnabledEvent,
  TwoFactorDisabledEvent,
} from '../../domain/events/two-factor-enabled.event';
import { SessionRevokedEvent } from '../../domain/events/session-revoked.event';

/**
 * Centralised fan-out for auth domain events. Each handler is independent —
 * a failure in one (e.g. email delivery) cannot affect another (audit) or
 * the originating write path.
 *
 * Two side-effect classes coexist here:
 *  1. AUDIT — always best-effort except where the use-case already logged
 *     strictly inside its own transaction (logout, password.changed, ...).
 *  2. EMAIL — fire-and-forget via the queued adapter; the queue + circuit
 *     breaker handle retries and provider outages.
 *
 * Session side-effects:
 *   - `PasswordChangedEvent.source = 'reset'` → revoke ALL sessions.
 *   - `PasswordChangedEvent.source = 'change'` → revoke ALL OTHER sessions
 *     (keep `event.keepSessionId`).
 */
@Injectable()
export class AuthNotificationListener {
  constructor(
    @Inject(AUTH_EMAIL_SERVICE)
    private readonly emails: IAuthEmailService,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: IAuthSessionRepository,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(AuthNotificationListener.name);
  }

  // ─── Sign-in / lockout ──────────────────────────────────────────────────

  @OnEvent(LoginFailedEvent.name)
  async onLoginFailed(event: LoginFailedEvent): Promise<void> {
    await this.audit.log({
      action: 'auth.login.failed',
      actorId: event.userId ?? undefined,
      metadata: {
        email: event.email,
        reason: event.reason,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      },
    });
    // No email — would enable user enumeration.
  }

  @OnEvent(LoginSucceededEvent.name)
  async onLoginSucceeded(event: LoginSucceededEvent): Promise<void> {
    this.logger.debug('Login succeeded event handled', {
      userId: event.userId,
      isNewDevice: event.isNewDevice,
    });
  }

  @OnEvent(NewDeviceDetectedEvent.name)
  async onNewDevice(event: NewDeviceDetectedEvent): Promise<void> {
    await this.emails.sendNewDeviceAlert({
      to: event.email,
      deviceLabel: event.deviceLabel,
      userAgent: event.userAgent,
      ipAddress: event.ipAddress,
      occurredAt: event.occurredAt,
    });
  }

  @OnEvent(AccountLockedEvent.name)
  async onAccountLocked(event: AccountLockedEvent): Promise<void> {
    await this.emails.sendAccountLockedNotification({
      to: event.email,
      lockedUntil: event.lockedUntil,
      ipAddress: event.ipAddress,
    });
  }

  @OnEvent(SuspiciousActivityDetectedEvent.name)
  async onSuspiciousActivity(
    event: SuspiciousActivityDetectedEvent,
  ): Promise<void> {
    await this.emails.sendSuspiciousActivityAlert({
      to: event.email,
      reason: event.reason,
      failedAttempts: event.failedAttempts,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      occurredAt: event.occurredAt,
    });
  }

  // ─── Password lifecycle ─────────────────────────────────────────────────

  @OnEvent(PasswordResetRequestedEvent.name)
  async onPasswordResetRequested(
    event: PasswordResetRequestedEvent,
  ): Promise<void> {
    await this.emails.sendPasswordResetRequested({
      to: event.email,
      code: event.code,
      expiresInMinutes: event.expiresInMinutes,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    });
  }

  @OnEvent(PasswordChangedEvent.name)
  async onPasswordChanged(event: PasswordChangedEvent): Promise<void> {
    const account = await this.accounts.findById(event.userId);
    if (!account) return;

    // Revoke sessions per the source semantics.
    const revoked = await this.sessions.revokeAllForUser(event.userId, {
      exceptSessionId: event.keepSessionId ?? undefined,
    });

    if (event.source === 'reset') {
      await this.emails.sendPasswordResetCompleted({
        to: account.email.value,
        ipAddress: event.ipAddress,
        occurredAt: event.occurredAt,
      });
    } else {
      await this.emails.sendPasswordChangedNotification({
        to: account.email.value,
        ipAddress: event.ipAddress,
        occurredAt: event.occurredAt,
      });
    }

    this.logger.info('Password changed side-effects done', {
      userId: event.userId,
      source: event.source,
      sessionsRevoked: revoked.length,
    });
  }

  // ─── 2FA ────────────────────────────────────────────────────────────────

  @OnEvent(TwoFactorEnabledEvent.name)
  async onTwoFactorEnabled(event: TwoFactorEnabledEvent): Promise<void> {
    await this.emails.sendTwoFactorEnabledNotification({
      to: event.email,
      ipAddress: null,
    });
  }

  @OnEvent(TwoFactorDisabledEvent.name)
  async onTwoFactorDisabled(event: TwoFactorDisabledEvent): Promise<void> {
    await this.emails.sendTwoFactorDisabledNotification({
      to: event.email,
      ipAddress: null,
    });
  }

  // ─── Social ─────────────────────────────────────────────────────────────

  @OnEvent(SocialAccountLinkedEvent.name)
  async onSocialAccountLinked(event: SocialAccountLinkedEvent): Promise<void> {
    await this.emails.sendSocialAccountLinked({
      to: event.email,
      provider: event.provider,
      ipAddress: event.ipAddress,
      occurredAt: event.occurredAt,
    });
  }

  // ─── Sessions (audit only) ──────────────────────────────────────────────

  @OnEvent(SessionRevokedEvent.name)
  async onSessionRevoked(event: SessionRevokedEvent): Promise<void> {
    await this.audit.log({
      action: 'auth.session.revoked',
      actorId: event.userId,
      resourceType: 'USER',
      resourceId: event.userId,
      metadata: {
        sessionIds: [...event.sessionIds],
        reason: event.reason,
      },
    });
  }
}
