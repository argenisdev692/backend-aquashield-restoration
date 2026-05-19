import { Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { ICachePort } from '../../../../shared/cache/cache.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IPasswordResetRepository } from '../../domain/repositories/password-reset.repository.interface';
import { PASSWORD_RESET_REPOSITORY } from '../../domain/repositories/password-reset.repository.interface';
import type { IOtpRepository } from '../../domain/repositories/otp.repository.interface';
import { OTP_REPOSITORY } from '../../domain/repositories/otp.repository.interface';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { OtpCode } from '../../domain/value-objects/otp-code.vo';
import { ResetToken } from '../../domain/value-objects/reset-token.vo';
import { maskEmail } from '../../../../shared/utils/mask.util';
import type { RequestPasswordResetInput } from '../dtos/request-password-reset.dto';

export interface RequestPasswordResetResult {
  resetToken: string;
  message: string;
}

/** How many forgot-password requests are allowed per email per window. */
const RESET_RATE_LIMIT = 3;
/** Rate-limit window in seconds (1 hour). */
const RESET_RATE_WINDOW_SECONDS = 60 * 60;
/** OTP validity window in minutes. */
const OTP_TTL_MINUTES = 10;
/** Reset token validity in ms (1 hour). */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1_000;

const SHARED_MESSAGE =
  'If an account with that email exists, a password reset code has been sent.';

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(PASSWORD_RESET_REPOSITORY)
    private readonly resetRepo: IPasswordResetRepository,
    @Inject(OTP_REPOSITORY)
    private readonly otpRepo: IOtpRepository,
    @Inject(EMAIL_PORT)
    private readonly emailPort: IEmailPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(RequestPasswordResetUseCase.name);
  }

  async execute(
    dto: RequestPasswordResetInput,
  ): Promise<RequestPasswordResetResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Password reset requested', {
      traceId,
      email: maskEmail(dto.email),
    });

    await this.enforceRateLimit(dto.email, traceId);

    const user = await this.userRepo.findByEmail(dto.email);

    // Prevent email enumeration: always return the same shape.
    if (!user) {
      this.logger.info('Password reset — email not found (silent)', {
        traceId,
      });
      return { resetToken: ResetToken.generate().raw, message: SHARED_MESSAGE };
    }

    await this.resetRepo.invalidateAllForUser(user.id);

    const otp = OtpCode.generate6(OTP_TTL_MINUTES);
    await this.otpRepo.save({
      userId: user.id,
      code: otp,
      type: 'password_reset',
    });

    const token = ResetToken.generate();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await this.resetRepo.save({ userId: user.id, token, expiresAt });

    await this.emailPort.sendPasswordResetCode({
      to: dto.email,
      code: otp.code,
      name: dto.email,
      ttlMinutes: OTP_TTL_MINUTES,
    });

    await this.audit.log({
      action: 'auth.password_reset_requested',
      resourceType: 'USER',
      resourceId: user.id,
    });

    this.logger.info('Password reset code sent', { traceId, userId: user.id });

    return { resetToken: token.raw, message: SHARED_MESSAGE };
  }

  private async enforceRateLimit(
    email: string,
    traceId: string,
  ): Promise<void> {
    const key = `auth:reset-rate:${email}`;
    const current = (await this.cache.get<number>(key)) ?? 0;

    if (current >= RESET_RATE_LIMIT) {
      this.logger.warn('Password reset rate limit exceeded', {
        traceId,
        email: maskEmail(email),
      });
      throw new HttpException(
        'Too many password reset requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const updated = current + 1;
    await this.cache.set(key, updated, RESET_RATE_WINDOW_SECONDS);

    if (updated === RESET_RATE_LIMIT) {
      this.emailPort
        .sendSecurityAlert({
          to: email,
          event: 'reset_attempts',
          attemptCount: updated,
        })
        .catch((err: Error) => {
          this.logger.error('Failed to send reset security alert', {
            traceId,
            error: err.message,
          });
        });
    }
  }
}
