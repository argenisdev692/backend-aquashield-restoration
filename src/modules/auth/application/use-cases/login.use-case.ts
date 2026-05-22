import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { ICachePort } from '../../../../shared/cache/cache.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import { maskEmail } from '../../../../shared/utils/mask.util';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IOtpRepository } from '../../domain/repositories/otp.repository.interface';
import { OTP_REPOSITORY } from '../../domain/repositories/otp.repository.interface';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port';
import type { IPasswordHasherPort } from '../../domain/ports/outbound/password-hasher.port';
import { PASSWORD_HASHER_PORT } from '../../domain/ports/outbound/password-hasher.port';
import type { ITokenServicePort } from '../../domain/ports/outbound/token-service.port';
import { TOKEN_SERVICE_PORT } from '../../domain/ports/outbound/token-service.port';
import { OtpCode } from '../../domain/value-objects/otp-code.vo';
import {
  NewDeviceLoginEvent,
  OtpRequestedEvent,
  UserLoggedInEvent,
} from '../../domain/events/auth-events';
import { deviceLabelFromUserAgent } from '../../domain/entities/auth-session.aggregate';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { ITrustedDeviceRepository } from '../../domain/repositories/trusted-device.repository.interface';
import { TRUSTED_DEVICE_REPOSITORY } from '../../domain/repositories/trusted-device.repository.interface';
import { TrustedDeviceToken } from '../../domain/value-objects/trusted-device-token.vo';
import { CLS_KEYS } from '../../../../shared/cls/cls.constants';
import { AuthTokenIssuer } from '../services/auth-token-issuer.service';
import type { LoginInput } from '../dtos/login.dto';

export interface LoginResult {
  requiresOtp: boolean;
  requiresTotp: boolean;
  requiresPasswordChange?: boolean;
  passwordChangeToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  /** True when a trusted-device cookie shortcut the 2FA challenge. */
  trustedDevice?: boolean;
  /** Mirrors AuthTokenIssuer.mustEnroll2fa for admin/superadmin accounts. */
  mustEnroll2fa?: boolean;
}

/** Maximum failed-password attempts before a security alert email is sent. */
const FAILED_LOGIN_ALERT_THRESHOLD = 3;
/** Failed attempts that trigger a temporary account lockout. */
const FAILED_LOGIN_LOCKOUT_THRESHOLD = 10;
/** How long an account stays locked after the threshold is hit (15 min). */
const ACCOUNT_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
/** Window in seconds to track consecutive failed logins (15 minutes). */
const FAILED_LOGIN_WINDOW_SECONDS = 15 * 60;
/** Shared 401 message — never leak whether the account is locked vs. wrong password. */
const INVALID_CREDENTIALS_MSG = 'Invalid credentials';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(OTP_REPOSITORY)
    private readonly otpRepo: IOtpRepository,
    @Inject(EMAIL_PORT)
    private readonly emailPort: IEmailPort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: IPasswordHasherPort,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: ITokenServicePort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    @Inject(TRUSTED_DEVICE_REPOSITORY)
    private readonly trustedDeviceRepo: ITrustedDeviceRepository,
    private readonly tokenIssuer: AuthTokenIssuer,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(LoginUseCase.name);
  }

  async execute(dto: LoginInput): Promise<LoginResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Login attempt', {
      traceId,
      email: maskEmail(dto.email),
    });

    const user = await this.userRepo.findByEmail(dto.email);
    if (!user || !user.password) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MSG);
    }

    // Reject immediately when the account is in a lockout window. The 401
    // (not 423 Locked) is intentional — exposing lock state would let an
    // attacker enumerate which accounts they have already targeted.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      this.logger.warn('Login blocked — account locked', {
        traceId,
        userId: user.id,
        lockedUntil: user.lockedUntil.toISOString(),
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS_MSG);
    }

    const valid = await this.passwordHasher.compare(
      dto.password,
      user.password,
    );
    if (!valid) {
      await this.handleFailedLogin(user.id, dto.email, traceId);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MSG);
    }

    // Clear the failure counter + any expired lock on a successful check.
    await this.cache.del(this.failedLoginKey(dto.email));
    if (user.lockedUntil) {
      await this.userRepo.clearLockedUntil(user.id);
    }

    // Check whether the password is expired or the user must change it.
    const passwordExpired =
      user.passwordExpiresAt !== null && user.passwordExpiresAt <= new Date();
    if (user.mustChangePassword || passwordExpired) {
      const passwordChangeToken =
        await this.tokenService.signPasswordChangeToken(user.id);

      await this.audit.log({
        action: 'auth.password_change_required',
        resourceType: 'USER',
        resourceId: user.id,
        metadata: { reason: user.mustChangePassword ? 'forced' : 'expired' },
      });

      this.logger.warn('Login blocked — password change required', {
        traceId,
        userId: user.id,
        reason: user.mustChangePassword ? 'forced' : 'expired',
      });

      return {
        requiresOtp: false,
        requiresTotp: false,
        requiresPasswordChange: true,
        passwordChangeToken,
      };
    }

    // Trusted-device shortcut: when the request carries a valid `td` cookie
    // we issue tokens immediately and skip the OTP/TOTP step. The cookie was
    // captured into CLS by the request middleware.
    const rawTrustedToken = this.cls.get<string>(CLS_KEYS.TRUSTED_DEVICE_TOKEN);
    if (rawTrustedToken) {
      const trusted = await this.trustedDeviceRepo.findValidForUser(
        user.id,
        TrustedDeviceToken.hashOf(rawTrustedToken),
      );
      if (trusted) {
        const tokens = await this.tokenIssuer.issue(user);
        await this.trustedDeviceRepo.touch(trusted.id);
        this.emitNewDeviceIfApplicable(user, tokens.isNewDevice);
        this.eventEmitter.emit(
          'auth.login',
          new UserLoggedInEvent(user.id),
        );
        await this.audit.log({
          action: 'auth.login',
          resourceType: 'USER',
          resourceId: user.id,
          metadata: { method: 'trusted_device', trustedDeviceId: trusted.id },
        });
        this.logger.info('User logged in via trusted device', {
          traceId,
          userId: user.id,
        });
        return {
          requiresOtp: false,
          requiresTotp: false,
          trustedDevice: true,
          ...tokens,
        };
      }
    }

    const otp = OtpCode.generate(5);
    await this.otpRepo.save({ userId: user.id, code: otp, type: 'login' });
    await this.emailPort.sendOtp({
      to: dto.email,
      code: otp.code,
      type: 'login',
    });

    this.eventEmitter.emit(
      'auth.otp_requested',
      new OtpRequestedEvent(user.id, 'login'),
    );

    await this.audit.log({
      action: 'auth.otp_requested',
      resourceType: 'USER',
      resourceId: user.id,
    });

    this.logger.info('OTP sent for login', { traceId, userId: user.id });
    return {
      requiresOtp: true,
      requiresTotp: user.totpEnabled,
    };
  }

  private async handleFailedLogin(
    userId: string,
    email: string,
    traceId: string,
  ): Promise<void> {
    const key = this.failedLoginKey(email);
    const current = (await this.cache.get<number>(key)) ?? 0;
    const updated = current + 1;

    await this.cache.set(key, updated, FAILED_LOGIN_WINDOW_SECONDS);

    await this.audit.log({
      action: 'auth.login_failed',
      resourceType: 'USER',
      resourceId: userId,
      metadata: { attempt: updated },
    });

    this.logger.warn('Failed login attempt', {
      traceId,
      userId,
      attempt: updated,
    });

    if (updated === FAILED_LOGIN_ALERT_THRESHOLD) {
      this.logger.warn('Security alert: failed login threshold reached', {
        traceId,
        userId,
        attempt: updated,
      });

      // Fire-and-forget: alert failure must never block the auth error response.
      this.emailPort
        .sendSecurityAlert({
          to: email,
          event: 'login_attempts',
          attemptCount: updated,
        })
        .catch((err: Error) => {
          this.logger.error('Failed to send security alert email', {
            traceId,
            error: err.message,
          });
        });

      await this.audit.log({
        action: 'auth.security_alert_sent',
        resourceType: 'USER',
        resourceId: userId,
        metadata: { event: 'login_attempts', attemptCount: updated },
      });
    }

    // Lockout: 10 failures within the 15-minute window → 15-minute lock.
    // The failure counter is left in place so a flood of pre-lock attempts
    // cannot reset the threshold by churning new IPs.
    if (updated >= FAILED_LOGIN_LOCKOUT_THRESHOLD) {
      const lockedUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MS);
      await this.userRepo.setLockedUntil(userId, lockedUntil);
      await this.audit.log({
        action: 'auth.account_locked',
        resourceType: 'USER',
        resourceId: userId,
        metadata: {
          attemptCount: updated,
          lockedUntil: lockedUntil.toISOString(),
          durationMinutes: ACCOUNT_LOCKOUT_DURATION_MS / 60_000,
        },
      });
      this.logger.warn('Account locked due to failed login threshold', {
        traceId,
        userId,
        attempt: updated,
        lockedUntil: lockedUntil.toISOString(),
      });
    }
  }

  private failedLoginKey(email: string): string {
    return `auth:login-failures:${email}`;
  }

  /**
   * Fire-and-forget: emits a NewDeviceLoginEvent when the issuer flagged
   * the session as unrecognised. The listener sends the alert email; any
   * failure must never block the login response.
   */
  private emitNewDeviceIfApplicable(
    user: { id: string; email: string },
    isNewDevice: boolean | undefined,
  ): void {
    if (!isNewDevice) return;
    const ua = this.cls.get<string>('userAgent') ?? null;
    const ip = this.cls.get<string>('ipAddress') ?? null;
    this.eventEmitter.emit(
      'auth.new_device_login',
      new NewDeviceLoginEvent(
        user.id,
        user.email,
        deviceLabelFromUserAgent(ua),
        ip,
        ua,
      ),
    );
  }
}
