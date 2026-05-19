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
import { OtpCode } from '../../domain/value-objects/otp-code.vo';
import {
  OtpVerifiedEvent,
  UserLoggedInEvent,
} from '../../domain/events/auth-events';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { ITransactionManager } from '../../../../shared/database/transaction-manager.port';
import { TRANSACTION_MANAGER } from '../../../../shared/database/transaction-manager.port';
import type { VerifyOtpInput } from '../dtos/verify-otp.dto';
import { AuthTokenIssuer } from '../services/auth-token-issuer.service';
import { maskEmail } from '../../../../shared/utils/mask.util';

export interface VerifyOtpResult {
  requiresTotp: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

/** Invalid OTP attempts allowed before the active code is burned. */
const MAX_OTP_ATTEMPTS = 5;
/** Window (seconds) the failed-attempt counter is kept (matches OTP TTL). */
const OTP_ATTEMPT_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class VerifyOtpUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(OTP_REPOSITORY)
    private readonly otpRepo: IOtpRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    @Inject(TRANSACTION_MANAGER)
    private readonly tx: ITransactionManager,
    private readonly tokenIssuer: AuthTokenIssuer,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(VerifyOtpUseCase.name);
  }

  async execute(dto: VerifyOtpInput): Promise<VerifyOtpResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Verify OTP attempt', {
      traceId,
      email: maskEmail(dto.email),
    });

    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const stored = await this.otpRepo.findValid(user.id, dto.type);
    // Constant-time comparison defends against timing oracles on the OTP.
    if (!stored || !OtpCode.safeEqual(stored.code, dto.code)) {
      await this.handleInvalidAttempt(user.id, dto.type, stored?.id ?? null);
      // handleInvalidAttempt always throws; this keeps control-flow analysis
      // happy and narrows `stored` to non-null below.
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Successful credential check — reset the brute-force counter.
    await this.cache.del(this.attemptKey(user.id, dto.type));

    // Consuming the OTP and (when TOTP is not required) minting a session
    // happen atomically so `markUsed` never sticks without a session.
    const sessionTokens = await this.tx.runInTx(async () => {
      await this.otpRepo.markUsed(stored.id);
      if (user.totpEnabled) {
        return null;
      }
      return this.tokenIssuer.issue(user);
    });

    this.eventEmitter.emit(
      'auth.otp_verified',
      new OtpVerifiedEvent(user.id, dto.type),
    );

    await this.audit.log({
      action: 'auth.otp_verified',
      resourceType: 'USER',
      resourceId: user.id,
      metadata: { type: dto.type },
    });

    // If TOTP is enabled, a second factor is still required.
    if (sessionTokens === null) {
      this.logger.info('OTP verified — TOTP required', {
        traceId,
        userId: user.id,
      });
      return { requiresTotp: true };
    }

    const tokens = sessionTokens;

    this.eventEmitter.emit('auth.login', new UserLoggedInEvent(user.id));
    await this.audit.log({
      action: 'auth.login',
      resourceType: 'USER',
      resourceId: user.id,
    });

    this.logger.info('User logged in', { traceId, userId: user.id });
    return { requiresTotp: false, ...tokens };
  }

  private attemptKey(userId: string, type: string): string {
    return `auth:otp-fail:${userId}:${type}`;
  }

  /**
   * Records a failed OTP attempt. After {@link MAX_OTP_ATTEMPTS} the active
   * code is burned so a guessable short OTP cannot be brute-forced past the
   * per-request throttle. Always throws.
   */
  private async handleInvalidAttempt(
    userId: string,
    type: string,
    otpId: string | null,
  ): Promise<never> {
    const key = this.attemptKey(userId, type);
    const attempts = ((await this.cache.get<number>(key)) ?? 0) + 1;
    await this.cache.set(key, attempts, OTP_ATTEMPT_WINDOW_SECONDS);

    if (attempts >= MAX_OTP_ATTEMPTS) {
      if (otpId) {
        await this.otpRepo.markUsed(otpId);
      }
      await this.cache.del(key);
      await this.audit.log({
        action: 'auth.otp_locked',
        resourceType: 'USER',
        resourceId: userId,
        metadata: { type, attempts },
      });
      throw new UnauthorizedException(
        'Too many invalid codes. Please request a new code.',
      );
    }

    await this.audit.log({
      action: 'auth.otp_failed',
      resourceType: 'USER',
      resourceId: userId,
      metadata: { type, attempts },
    });
    throw new UnauthorizedException('Invalid or expired OTP');
  }
}
