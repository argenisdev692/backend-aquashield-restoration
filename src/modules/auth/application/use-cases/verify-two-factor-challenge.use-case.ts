import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IOtpRepository } from '../../domain/repositories/otp.repository.interface';
import { OTP_REPOSITORY } from '../../domain/repositories/otp.repository.interface';
import type { ITotpPort } from '../../domain/ports/outbound/totp.port';
import { TOTP_PORT } from '../../domain/ports/outbound/totp.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { ITransactionManager } from '../../../../shared/database/transaction-manager.port';
import { TRANSACTION_MANAGER } from '../../../../shared/database/transaction-manager.port';
import { OtpCode } from '../../domain/value-objects/otp-code.vo';
import {
  OtpVerifiedEvent,
  UserLoggedInEvent,
} from '../../domain/events/auth-events';
import { AuthTokenIssuer } from '../services/auth-token-issuer.service';
import type { VerifyTwoFactorChallengeInput } from '../dtos/verify-two-factor-challenge.dto';

export interface TwoFactorChallengeResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class VerifyTwoFactorChallengeUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(OTP_REPOSITORY)
    private readonly otpRepo: IOtpRepository,
    @Inject(TOTP_PORT)
    private readonly totp: ITotpPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER)
    private readonly tx: ITransactionManager,
    private readonly tokenIssuer: AuthTokenIssuer,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(VerifyTwoFactorChallengeUseCase.name);
  }

  async execute(
    dto: VerifyTwoFactorChallengeInput,
  ): Promise<TwoFactorChallengeResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('TwoFactorChallenge attempt', {
      traceId,
      email: dto.email,
      type: dto.type,
    });

    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid challenge');
    }

    if (dto.type === 'otp') {
      return this.handleOtp(user, dto.code, traceId);
    }
    return this.handleTotp(user, dto.code, traceId);
  }

  private async handleOtp(
    user: { id: string; email: string; roleIds: string[]; totpEnabled: boolean },
    code: string,
    traceId: string,
  ): Promise<TwoFactorChallengeResult> {
    const stored = await this.otpRepo.findValid(user.id, 'login');
    if (!stored || !OtpCode.safeEqual(stored.code, code)) {
      await this.audit.log({
        action: 'auth.otp_failed',
        resourceType: 'USER',
        resourceId: user.id,
        metadata: { type: 'login' },
      });
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const tokens = await this.tx.runInTx(async () => {
      await this.otpRepo.markUsed(stored.id);
      return this.tokenIssuer.issue(user);
    });

    this.eventEmitter.emit(
      'auth.otp_verified',
      new OtpVerifiedEvent(user.id, 'login'),
    );
    this.eventEmitter.emit('auth.login', new UserLoggedInEvent(user.id));

    await this.audit.log({
      action: 'auth.login',
      resourceType: 'USER',
      resourceId: user.id,
      metadata: { method: 'otp' },
    });

    this.logger.info('Two-factor OTP verified', { traceId, userId: user.id });
    return tokens;
  }

  private async handleTotp(
    user: {
      id: string;
      email: string;
      roleIds: string[];
      totpSecret: string | null;
    },
    code: string,
    traceId: string,
  ): Promise<TwoFactorChallengeResult> {
    if (!user.totpSecret) {
      throw new UnauthorizedException('2FA not configured');
    }

    const valid = await this.totp.verify({
      secret: user.totpSecret,
      token: code,
    });
    if (!valid) {
      await this.audit.log({
        action: 'auth.totp_failed',
        resourceType: 'USER',
        resourceId: user.id,
      });
      throw new UnauthorizedException('Invalid TOTP code');
    }

    const tokens = await this.tokenIssuer.issue(user);

    this.eventEmitter.emit('auth.login', new UserLoggedInEvent(user.id));

    await this.audit.log({
      action: 'auth.login',
      resourceType: 'USER',
      resourceId: user.id,
      metadata: { method: 'totp' },
    });

    this.logger.info('Two-factor TOTP verified', { traceId, userId: user.id });
    return tokens;
  }
}
