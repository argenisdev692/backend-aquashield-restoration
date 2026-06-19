import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { CLS_KEYS } from '../../../../shared/cls/cls.constants';
import {
  USER_ACCOUNT_REPOSITORY,
  type IUserAccountRepository,
} from '../../domain/ports/user-account.repository.port';
import {
  OTP_CODE_REPOSITORY,
  type IOtpCodeRepository,
} from '../../domain/ports/otp-code.repository.port';
import {
  AUTH_EMAIL_SERVICE,
  type IAuthEmailService,
} from '../../domain/ports/auth-email.port';
import {
  AUTH_RATE_LIMITER,
  type IAuthRateLimiter,
} from '../../domain/ports/rate-limiter.port';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../../shared/activity-log/audit.port';
import { OtpCode } from '../../domain/entities/otp-code.entity';
import {
  OTP_CODE_TTL_SECONDS,
  OTP_RESEND_THROTTLE_SECONDS,
} from '../../domain/value-objects/otp-code-type.vo';
import { generateNumericCode } from '../utils/numeric-code.util';
import type { ResendVerificationCodeInput } from '../dto/resend-verification-code.dto';

/**
 * Resend the `email_verify` OTP for an account that registered but has not
 * yet confirmed its address (or whose previous code has expired).
 *
 * Behavior:
 *   - silent no-op when the email is unknown or already verified (no
 *     enumeration via timing — same response shape and latency budget),
 *   - hard throttle: 1 resend per 60 s per email (Redis counter) → 429,
 *   - invalidate previous pending codes before issuing the new one so the
 *     old one can no longer be used (one valid code at a time).
 */
@Injectable()
export class ResendVerificationCodeUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(OTP_CODE_REPOSITORY)
    private readonly otps: IOtpCodeRepository,
    @Inject(AUTH_EMAIL_SERVICE)
    private readonly emails: IAuthEmailService,
    @Inject(AUTH_RATE_LIMITER)
    private readonly limiter: IAuthRateLimiter,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(ResendVerificationCodeUseCase.name);
  }

  async execute(
    input: ResendVerificationCodeInput,
  ): Promise<{ expiresInMinutes: number }> {
    const email = input.email.toLowerCase();
    const expiresInMinutes = Math.floor(OTP_CODE_TTL_SECONDS.email_verify / 60);

    // Pre-account-lookup throttle (per email): 1 request / 60 s. We throttle
    // even for unknown emails so an attacker cannot map registered emails by
    // observing whether the call returns 429 or 200.
    const throttleKey = `resend-verify:${email}`;
    const count = await this.limiter.recordIpHit(
      throttleKey,
      OTP_RESEND_THROTTLE_SECONDS,
    );
    if (count > 1) {
      throw new HttpException(
        {
          code: 'AUTH_RESEND_THROTTLED',
          message: 'Please wait before requesting a new code',
          retryAfterSeconds: OTP_RESEND_THROTTLE_SECONDS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const account = await this.accounts.findByEmail(email);
    // Silent no-op so the response is identical for unknown / verified
    // emails. Logged at debug for diagnostics.
    if (!account || account.isEmailVerified()) {
      this.logger.debug('Resend verification: no-op', {
        email,
        reason: !account ? 'unknown_email' : 'already_verified',
      });
      return { expiresInMinutes };
    }

    const code = generateNumericCode(6);
    await this.issue(account.id, code);

    await this.emails.sendEmailVerification({
      to: email,
      code,
      expiresInMinutes,
    });

    await this.audit.log({
      action: 'auth.verification_code.resent',
      actorId: account.id,
      resourceType: 'USER',
      resourceId: account.id,
      metadata: {
        ipAddress: this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null,
      },
    });

    this.logger.info('Verification code resent', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId: account.id,
    });

    return { expiresInMinutes };
  }

  @Transactional()
  private async issue(userId: string, code: string): Promise<void> {
    await this.otps.invalidatePending(userId, 'email_verify');
    await this.otps.create(
      OtpCode.create({ userId, code, type: 'email_verify' }),
    );
  }
}
