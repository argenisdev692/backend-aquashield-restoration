import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { ICachePort } from '../../../../shared/cache/cache.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
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
import { OtpRequestedEvent } from '../../domain/events/auth-events';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { LoginInput } from '../dtos/login.dto';

export interface LoginResult {
  requiresOtp: boolean;
  requiresTotp: boolean;
  requiresPasswordChange?: boolean;
  passwordChangeToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

/** Maximum failed-password attempts before a security alert email is sent. */
const FAILED_LOGIN_ALERT_THRESHOLD = 3;
/** Window in seconds to track consecutive failed logins (15 minutes). */
const FAILED_LOGIN_WINDOW_SECONDS = 15 * 60;

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
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(LoginUseCase.name);
  }

  async execute(dto: LoginInput): Promise<LoginResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Login attempt', { traceId, email: dto.email });

    const user = await this.userRepo.findByEmail(dto.email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.passwordHasher.compare(
      dto.password,
      user.password,
    );
    if (!valid) {
      await this.handleFailedLogin(user.id, dto.email, traceId);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Clear the failure counter on a successful credential check.
    await this.cache.del(this.failedLoginKey(dto.email));

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
  }

  private failedLoginKey(email: string): string {
    return `auth:login-failures:${email}`;
  }
}
