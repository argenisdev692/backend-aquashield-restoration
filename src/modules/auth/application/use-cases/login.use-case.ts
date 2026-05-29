import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '../../../../logger/logger.service';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { CLS_KEYS } from '../../../../shared/cls/cls.constants';
import { resolveRefreshTtlDays } from '../utils/session-ttl.util';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../../shared/activity-log/audit.port';
import {
  PASSWORD_HASHER_PORT,
  type IPasswordHasherPort,
} from '../../../../shared/security/password-hasher.port';
import {
  USER_ACCOUNT_REPOSITORY,
  type IUserAccountRepository,
} from '../../domain/ports/user-account.repository.port';
import {
  BACKUP_CODE_REPOSITORY,
  type IBackupCodeRepository,
} from '../../domain/ports/backup-code.repository.port';
import {
  AUTH_RATE_LIMITER,
  type IAuthRateLimiter,
} from '../../domain/ports/rate-limiter.port';
import {
  AccountLockedException,
  EmailNotVerifiedException,
  InvalidCredentialsException,
} from '../../domain/exceptions/auth-domain.exception';
import {
  FAILED_LOGIN_LOCKOUT_THRESHOLD,
  FAILED_LOGIN_WARN_THRESHOLD,
  FAILED_LOGIN_WINDOW_SECONDS,
} from '../../domain/entities/user-account.aggregate';
import { LoginSucceededEvent } from '../../domain/events/login-succeeded.event';
import { LoginFailedEvent } from '../../domain/events/login-failed.event';
import { SuspiciousActivityDetectedEvent } from '../../domain/events/suspicious-activity-detected.event';
import { NewDeviceDetectedEvent } from '../../domain/events/new-device-detected.event';
import { SessionIssuer } from '../session-issuer.service';
import type { LoginInput } from '../dto/login.dto';
import type {
  AuthTokensResponse,
  TwoFactorChallengeResponse,
} from '../presenters/auth.response';

export type LoginResult = AuthTokensResponse | TwoFactorChallengeResponse;

/**
 * Password login. Flow:
 *   1. Pre-credential guard: account-lockout (do NOT reveal email exists).
 *   2. Verify bcrypt hash. ALWAYS run a dummy bcrypt.compare on missing
 *      users so response time does not leak existence.
 *   3. Post-credential guard: email must be verified.
 *   4. If TOTP enabled:
 *        - if a valid trusted-device cookie is present → emit full tokens,
 *        - otherwise → emit a `tfa:false` access token (the client posts
 *          /two-factor/verify next).
 *   5. Reset failure counter, audit `auth.login.succeeded`.
 *
 * Suspicious activity:
 *   - on the 5th failure (WARN threshold) emit `SuspiciousActivityDetectedEvent`
 *     so the user is warned BEFORE we lock them out,
 *   - on the 10th failure (LOCK threshold) call `account.lock()` which emits
 *     `AccountLockedEvent` → email + audit via listener.
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(BACKUP_CODE_REPOSITORY)
    private readonly backupCodes: IBackupCodeRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly hasher: IPasswordHasherPort,
    @Inject(AUTH_RATE_LIMITER)
    private readonly limiter: IAuthRateLimiter,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly sessionIssuer: SessionIssuer,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(LoginUseCase.name);
  }

  async execute(input: LoginInput): Promise<LoginResult> {
    const email = input.email.toLowerCase();
    const ip = this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null;
    const ua = this.cls.get<string>(CLS_KEYS.USER_AGENT) ?? null;
    const trustedDeviceToken =
      this.cls.get<string>(CLS_KEYS.TRUSTED_DEVICE_TOKEN) ?? null;

    const account = await this.accounts.findByEmail(email);

    // 1. Pre-credential lockout gate — also handles "no such account" by
    //    burning equivalent CPU on a dummy bcrypt below.
    if (account?.isLocked()) {
      this.events.emit(LoginFailedEvent.name, new LoginFailedEvent(
        email, 'account_locked', ip, ua, account.id,
      ));
      throw new AccountLockedException(account.lockedUntil!);
    }

    // 2. Verify password — dummy hash for missing users to neutralise timing.
    const passwordOk = account?.passwordHash
      ? await this.hasher.compare(input.password, account.passwordHash)
      : await this.dummyCompare(input.password);

    if (!account || !passwordOk) {
      await this.handleFailedAttempt(account, email, ip, ua);
      throw new InvalidCredentialsException();
    }

    // 3. Email must be verified before any token is issued.
    if (!account.isEmailVerified()) {
      this.events.emit(LoginFailedEvent.name, new LoginFailedEvent(
        email, 'email_not_verified', ip, ua, account.id,
      ));
      throw new EmailNotVerifiedException();
    }

    // Credentials passed — clear failure counter immediately.
    await this.limiter.clearFailures(this.failureKey(email));

    // 4. 2FA decision — does this device skip the challenge?
    const bypassedViaTrustedDevice = account.totpEnabled
      ? await this.sessionIssuer.resolveTrustedDevice(
          account.id,
          trustedDeviceToken,
        )
      : false;
    const twoFactorSatisfied = !account.totpEnabled || bypassedViaTrustedDevice;

    // Refresh-token TTL is tighter for admin / super-admin accounts.
    const ttlDays = await resolveRefreshTtlDays(this.prisma, account.id);

    const issued = await this.sessionIssuer.issue(
      account,
      { ipAddress: ip, userAgent: ua },
      twoFactorSatisfied,
      ttlDays,
    );

    // Password expiry surfaced as a flag — the frontend redirects to
    // change-password without us blocking the login (the user MUST be able
    // to authenticate to change their expired password).
    const mustChangePassword =
      account.mustChangePassword || account.isPasswordExpired();
    const passwordExpiresAtIso =
      account.passwordExpiresAt?.toISOString() ?? null;

    let response: LoginResult;
    if (account.totpEnabled && !twoFactorSatisfied) {
      const remaining = (
        await this.backupCodes.findUnusedByUserId(account.id)
      ).length;
      response = {
        accessToken: issued.accessToken,
        accessTokenExpiresAt: issued.accessTokenExpiresAt.toISOString(),
        twoFactorRequired: true,
        backupCodesRemaining: remaining,
        mustChangePassword,
        passwordExpiresAt: passwordExpiresAtIso,
      };
    } else {
      response = {
        accessToken: issued.accessToken,
        accessTokenExpiresAt: issued.accessTokenExpiresAt.toISOString(),
        refreshToken: issued.refreshToken,
        twoFactorRequired: false,
        mustChangePassword,
        passwordExpiresAt: passwordExpiresAtIso,
      };
    }

    // Mark the account as freshly authenticated.
    await this.markFresh(account.id);

    // 5. Audit + domain events (after persistence).
    await this.audit.log({
      action: 'auth.login.succeeded',
      actorId: account.id,
      resourceType: 'USER',
      resourceId: account.id,
      metadata: {
        ipAddress: ip,
        userAgent: ua,
        twoFactorBypassed: issued.twoFactorBypassed,
      },
    });

    this.events.emit(LoginSucceededEvent.name, new LoginSucceededEvent(
      account.id,
      issued.sessionId,
      ua ?? '',
      ip,
      ua,
      issued.isNewDevice,
    ));

    if (issued.isNewDevice) {
      this.events.emit(NewDeviceDetectedEvent.name, new NewDeviceDetectedEvent(
        account.id,
        account.email.value,
        issued.sessionId,
        null,
        ua,
        ip,
      ));
    }

    this.logger.info('Login succeeded', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId: account.id,
      twoFactorRequired: 'twoFactorRequired' in response && response.twoFactorRequired,
    });

    return response;
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  private failureKey(email: string): string {
    return `login:fail:${email}`;
  }

  private async handleFailedAttempt(
    account: Awaited<ReturnType<IUserAccountRepository['findByEmail']>>,
    email: string,
    ip: string | null,
    ua: string | null,
  ): Promise<void> {
    // Increment a counter even for unknown emails so an attacker cannot
    // distinguish "wrong password" from "no such user".
    const failures = await this.limiter.recordFailure(
      this.failureKey(email),
      FAILED_LOGIN_WINDOW_SECONDS,
    );

    this.events.emit(LoginFailedEvent.name, new LoginFailedEvent(
      email,
      'invalid_credentials',
      ip,
      ua,
      account?.id ?? null,
    ));

    if (!account) return;

    // Warning email before the lock — only fire ONCE at the threshold.
    if (failures === FAILED_LOGIN_WARN_THRESHOLD) {
      this.events.emit(
        SuspiciousActivityDetectedEvent.name,
        new SuspiciousActivityDetectedEvent(
          account.id,
          account.email.value,
          'repeated_failed_logins',
          failures,
          ip,
          ua,
        ),
      );
    }

    // Lock at the threshold.
    if (failures >= FAILED_LOGIN_LOCKOUT_THRESHOLD) {
      await this.lockAccount(account.id, ip);
    }
  }

  @Transactional()
  private async lockAccount(userId: string, ip: string | null): Promise<void> {
    const account = await this.accounts.findById(userId);
    if (!account) return;
    if (account.isLocked()) return;
    account.lock({ ipAddress: ip });
    await this.accounts.save(account);
    // Forward the AccountLockedEvent added by the aggregate.
    for (const event of account.domainEvents) {
      this.events.emit((event as { constructor: { name: string } }).constructor.name, event);
    }
    account.clearDomainEvents();
    await this.audit.log(
      {
        action: 'auth.account.locked',
        actorId: userId,
        resourceType: 'USER',
        resourceId: userId,
        metadata: { ipAddress: ip },
      },
      { strict: true },
    );
  }

  @Transactional()
  private async markFresh(userId: string): Promise<void> {
    const account = await this.accounts.findById(userId);
    if (!account) return;
    account.recordSuccessfulLogin();
    await this.accounts.save(account);
  }

  /**
   * Dummy bcrypt.compare against a fixed throwaway hash so the response
   * time for "unknown email" matches "wrong password" within ~5 ms.
   */
  private dummyCompare(plaintext: string): Promise<boolean> {
    return this.hasher.compare(plaintext, DUMMY_BCRYPT_HASH);
  }
}

// Fixed throwaway bcrypt hash (cost 12) — burns the same CPU as a real
// compare. Never matches any real password.
const DUMMY_BCRYPT_HASH =
  '$2b$12$Cw5e9o0gJ0t3o7s5tQy0E.5Vw6u5/u4M0Z0LqYf2zG3a8Lj4WJ7p2';
