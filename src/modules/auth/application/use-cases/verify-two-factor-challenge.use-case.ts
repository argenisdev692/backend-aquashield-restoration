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
import type { IBackupCodeRepository } from '../../domain/repositories/backup-code.repository.interface';
import { BACKUP_CODE_REPOSITORY } from '../../domain/repositories/backup-code.repository.interface';
import type { IPasswordHasherPort } from '../../domain/ports/outbound/password-hasher.port';
import { PASSWORD_HASHER_PORT } from '../../domain/ports/outbound/password-hasher.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { ITransactionManager } from '../../../../shared/database/transaction-manager.port';
import { TRANSACTION_MANAGER } from '../../../../shared/database/transaction-manager.port';
import { OtpCode } from '../../domain/value-objects/otp-code.vo';
import { BackupCode } from '../../domain/value-objects/backup-code.vo';
import { TrustedDeviceToken } from '../../domain/value-objects/trusted-device-token.vo';
import { deviceLabelFromUserAgent } from '../../domain/entities/auth-session.aggregate';
import type { ITrustedDeviceRepository } from '../../domain/repositories/trusted-device.repository.interface';
import { TRUSTED_DEVICE_REPOSITORY } from '../../domain/repositories/trusted-device.repository.interface';
import { CLS_KEYS } from '../../../../shared/cls/cls.constants';
import {
  NewDeviceLoginEvent,
  OtpVerifiedEvent,
  UserLoggedInEvent,
} from '../../domain/events/auth-events';
import { AuthTokenIssuer } from '../services/auth-token-issuer.service';
import type { VerifyTwoFactorChallengeInput } from '../dtos/verify-two-factor-challenge.dto';

export interface TwoFactorChallengeResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  /** True when the user authenticated with a single-use backup code. UI should warn them. */
  usedBackupCode?: boolean;
  /** Remaining unused backup codes — only set when usedBackupCode=true. */
  backupCodesRemaining?: number;
  /** Raw trusted-device token — controller must set it as the `td` cookie. */
  trustedDeviceToken?: string;
  /** TTL (ms) for the trusted-device cookie. */
  trustedDeviceTtlMs?: number;
  mustEnroll2fa?: boolean;
  isNewDevice?: boolean;
}

/** Trusted-device cookie TTL: 30 days, per the Laravel enterprise spec. */
const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class VerifyTwoFactorChallengeUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(OTP_REPOSITORY)
    private readonly otpRepo: IOtpRepository,
    @Inject(TOTP_PORT)
    private readonly totp: ITotpPort,
    @Inject(BACKUP_CODE_REPOSITORY)
    private readonly backupCodeRepo: IBackupCodeRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: IPasswordHasherPort,
    @Inject(TRUSTED_DEVICE_REPOSITORY)
    private readonly trustedDeviceRepo: ITrustedDeviceRepository,
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

  private async maybeIssueTrustedDevice(
    userId: string,
    trust: boolean | undefined,
  ): Promise<{ token: string; ttlMs: number } | null> {
    if (!trust) return null;
    const token = TrustedDeviceToken.generate();
    const ua = this.cls.get<string>(CLS_KEYS.USER_AGENT) ?? null;
    const ip = this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null;
    await this.trustedDeviceRepo.save({
      userId,
      deviceTokenHash: token.hash,
      label: deviceLabelFromUserAgent(ua),
      userAgent: ua,
      ipAddress: ip,
      expiresAt: new Date(Date.now() + TRUSTED_DEVICE_TTL_MS),
    });
    await this.audit.log({
      action: 'auth.trusted_device_added',
      resourceType: 'USER',
      resourceId: userId,
      metadata: { label: deviceLabelFromUserAgent(ua) },
    });
    return { token: token.raw, ttlMs: TRUSTED_DEVICE_TTL_MS };
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

    let result: TwoFactorChallengeResult;
    if (dto.type === 'otp') {
      result = await this.handleOtp(user, dto.code, traceId);
    } else if (dto.type === 'backup_code') {
      result = await this.handleBackupCode(user, dto.code, traceId);
    } else {
      result = await this.handleTotp(user, dto.code, traceId);
    }

    const trusted = await this.maybeIssueTrustedDevice(user.id, dto.trustDevice);
    if (trusted) {
      result.trustedDeviceToken = trusted.token;
      result.trustedDeviceTtlMs = trusted.ttlMs;
    }

    if (result.isNewDevice) {
      const ua = this.cls.get<string>(CLS_KEYS.USER_AGENT) ?? null;
      const ip = this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null;
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

    return result;
  }

  private async handleOtp(
    user: {
      id: string;
      email: string;
      roleIds: string[];
      roleNames: string[];
      totpEnabled: boolean;
    },
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
      roleNames: string[];
      totpEnabled: boolean;
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

  private async handleBackupCode(
    user: {
      id: string;
      email: string;
      roleIds: string[];
      roleNames: string[];
      totpEnabled: boolean;
    },
    rawCode: string,
    traceId: string,
  ): Promise<TwoFactorChallengeResult> {
    if (!user.totpEnabled) {
      throw new UnauthorizedException('2FA not configured');
    }

    const normalized = BackupCode.normalize(rawCode);
    const unused = await this.backupCodeRepo.findUnusedByUserId(user.id);

    // Time-constant lookup: we always iterate every unused code so the
    // response time does not leak whether the code matched the first or
    // the last row.
    let matched: { id: string } | null = null;
    for (const row of unused) {
      const ok = await this.passwordHasher.compare(normalized, row.codeHash);
      if (ok && !matched) matched = { id: row.id };
    }

    if (!matched) {
      await this.audit.log({
        action: 'auth.backup_code_failed',
        resourceType: 'USER',
        resourceId: user.id,
      });
      throw new UnauthorizedException('Invalid backup code');
    }

    const tokens = await this.tx.runInTx(async () => {
      await this.backupCodeRepo.markUsed(matched.id);
      return this.tokenIssuer.issue(user);
    });

    const remaining = await this.backupCodeRepo.countUnusedByUserId(user.id);

    this.eventEmitter.emit('auth.login', new UserLoggedInEvent(user.id));
    await this.audit.log(
      {
        action: 'auth.login',
        resourceType: 'USER',
        resourceId: user.id,
        metadata: { method: 'backup_code', backupCodesRemaining: remaining },
      },
      { strict: true },
    );

    this.logger.warn('Two-factor backup code used', {
      traceId,
      userId: user.id,
      remaining,
    });
    return { ...tokens, usedBackupCode: true, backupCodesRemaining: remaining };
  }
}
