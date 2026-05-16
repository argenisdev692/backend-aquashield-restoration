import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
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

export interface VerifyOtpResult {
  requiresTotp: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

@Injectable()
export class VerifyOtpUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(OTP_REPOSITORY)
    private readonly otpRepo: IOtpRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
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
    this.logger.info('Verify OTP attempt', { traceId, email: dto.email });

    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const stored = await this.otpRepo.findValid(user.id, dto.type);
    // Constant-time comparison defends against timing oracles on the OTP.
    if (!stored || !OtpCode.safeEqual(stored.code, dto.code)) {
      await this.audit.log({
        action: 'auth.otp_failed',
        resourceType: 'USER',
        resourceId: user.id,
        metadata: { type: dto.type },
      });
      throw new UnauthorizedException('Invalid or expired OTP');
    }

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
}
