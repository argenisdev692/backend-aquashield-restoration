import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { createHash, randomBytes } from 'node:crypto';
import { LoggerService } from '../../../../logger/logger.service';
import { CLS_KEYS } from '../../../../shared/cls/cls.constants';
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
  AUTH_SESSION_REPOSITORY,
  type IAuthSessionRepository,
} from '../../domain/ports/auth-session.repository.port';
import {
  BACKUP_CODE_REPOSITORY,
  type IBackupCodeRepository,
} from '../../domain/ports/backup-code.repository.port';
import {
  TRUSTED_DEVICE_REPOSITORY,
  type ITrustedDeviceRepository,
} from '../../domain/ports/trusted-device.repository.port';
import {
  TOTP_SERVICE,
  type ITotpService,
} from '../../domain/ports/totp.port';
import {
  AUTH_RATE_LIMITER,
  type IAuthRateLimiter,
} from '../../domain/ports/rate-limiter.port';
import {
  JWT_ISSUER,
  type IJwtIssuer,
} from '../../domain/ports/jwt-issuer.port';
import {
  BackupCodeInvalidException,
  TwoFactorInvalidException,
  TwoFactorNotEnabledException,
  UserAccountNotFoundException,
} from '../../domain/exceptions/auth-domain.exception';
import { SuspiciousActivityDetectedEvent } from '../../domain/events/suspicious-activity-detected.event';
import { TrustedDevice } from '../../domain/entities/trusted-device.entity';
import { FAILED_LOGIN_WARN_THRESHOLD } from '../../domain/entities/user-account.aggregate';
import { generateRefreshToken } from '../../infrastructure/crypto/refresh-token.util';
import { RefreshTokenHash } from '../../domain/value-objects/refresh-token-hash.vo';
import type { VerifyTwoFactorChallengeInput } from '../dto/verify-two-factor-challenge.dto';
import type { AuthTokensResponse } from '../presenters/auth.response';

export interface VerifyTwoFactorOutput {
  tokens: AuthTokensResponse;
  /** Raw trusted-device cookie value when `trustDevice=true`, else null. */
  trustedDeviceToken: string | null;
}

/**
 * Second step of the login flow. Caller arrives with the mid-challenge
 * access token (`tfa:false`) extracted by `JwtAuthGuard`; this use-case
 * validates the TOTP code (or backup code), upgrades the access token to
 * `tfa:true`, and optionally persists a 30-day trusted-device cookie.
 *
 * Failed attempts are counted in Redis. On the 5th failure we emit
 * `SuspiciousActivityDetectedEvent` (reason `failed_two_factor`).
 */
@Injectable()
export class VerifyTwoFactorChallengeUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: IAuthSessionRepository,
    @Inject(BACKUP_CODE_REPOSITORY)
    private readonly backupCodes: IBackupCodeRepository,
    @Inject(TRUSTED_DEVICE_REPOSITORY)
    private readonly trustedDevices: ITrustedDeviceRepository,
    @Inject(TOTP_SERVICE) private readonly totp: ITotpService,
    @Inject(JWT_ISSUER) private readonly jwt: IJwtIssuer,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly hasher: IPasswordHasherPort,
    @Inject(AUTH_RATE_LIMITER)
    private readonly limiter: IAuthRateLimiter,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly events: EventEmitter2,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(VerifyTwoFactorChallengeUseCase.name);
  }

  async execute(args: {
    userId: string;
    sessionId: string;
    input: VerifyTwoFactorChallengeInput;
  }): Promise<VerifyTwoFactorOutput> {
    const ip = this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null;
    const ua = this.cls.get<string>(CLS_KEYS.USER_AGENT) ?? null;

    const account = await this.accounts.findById(args.userId);
    if (!account) throw new UserAccountNotFoundException();
    if (!account.totpEnabled) throw new TwoFactorNotEnabledException();

    const session = await this.sessions.findById(args.sessionId);
    if (!session || session.userId !== account.id || !session.isActive()) {
      throw new TwoFactorInvalidException();
    }

    const ok = args.input.code
      ? this.totp.verify(account.totpSecret!.reveal(), args.input.code)
      : await this.verifyBackupCode(account.id, args.input.backupCode!);

    if (!ok) {
      const failures = await this.limiter.recordFailure(
        `2fa:fail:${account.id}`,
        5 * 60,
      );
      if (failures === FAILED_LOGIN_WARN_THRESHOLD) {
        this.events.emit(
          SuspiciousActivityDetectedEvent.name,
          new SuspiciousActivityDetectedEvent(
            account.id,
            account.email.value,
            'failed_two_factor',
            failures,
            ip,
            ua,
          ),
        );
      }
      throw args.input.code
        ? new TwoFactorInvalidException()
        : new BackupCodeInvalidException();
    }

    await this.limiter.clearFailures(`2fa:fail:${account.id}`);

    // Issue trusted-device cookie BEFORE re-signing the token so the value
    // can be returned by the controller as a `Set-Cookie` header.
    let trustedDeviceToken: string | null = null;
    if (args.input.trustDevice) {
      trustedDeviceToken = await this.issueTrustedDevice(account.id, ip, ua);
    }

    // Re-sign the access token with `tfa:true` AND rotate the refresh row.
    const tokens = await this.upgradeTokens(account.id, args.sessionId);

    await this.audit.log({
      action: 'auth.two_factor.verified',
      actorId: account.id,
      resourceType: 'USER',
      resourceId: account.id,
      metadata: {
        method: args.input.code ? 'totp' : 'backup_code',
        trustDevice: !!args.input.trustDevice,
        ipAddress: ip,
      },
    });

    return { tokens, trustedDeviceToken };
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  private async verifyBackupCode(
    userId: string,
    candidate: string,
  ): Promise<boolean> {
    const unused = await this.backupCodes.findUnusedByUserId(userId);
    for (const code of unused) {
      // bcrypt.compare is constant-time per-comparison; iterating leaks
      // nothing more than "user has N codes" (already exposed via login).
      if (await this.hasher.compare(candidate, code.codeHash)) {
        await this.backupCodes.markUsed(code.id!);
        return true;
      }
    }
    return false;
  }

  @Transactional()
  private async upgradeTokens(
    userId: string,
    sessionId: string,
  ): Promise<AuthTokensResponse> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new TwoFactorInvalidException();

    const account = await this.accounts.findById(userId);
    if (!account) throw new TwoFactorInvalidException();

    const { raw, hash } = generateRefreshToken();
    session.rotate(RefreshTokenHash.create(hash));
    await this.sessions.save(session);

    const access = await this.jwt.signAccessToken({
      sub: userId,
      sid: sessionId,
      twoFactor: true,
    });

    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken: raw,
      twoFactorRequired: false,
      mustChangePassword:
        account.mustChangePassword || account.isPasswordExpired(),
      passwordExpiresAt: account.passwordExpiresAt?.toISOString() ?? null,
    };
  }

  private async issueTrustedDevice(
    userId: string,
    ip: string | null,
    ua: string | null,
  ): Promise<string> {
    const raw = randomBytes(48).toString('base64url');
    const hash = createHash('sha256').update(raw).digest('hex');
    const device = TrustedDevice.create({
      userId,
      deviceTokenHash: hash,
      label: ua ? ua.slice(0, 80) : null,
      userAgent: ua,
      ipAddress: ip,
    });
    await this.trustedDevices.create(device);
    return raw;
  }
}
