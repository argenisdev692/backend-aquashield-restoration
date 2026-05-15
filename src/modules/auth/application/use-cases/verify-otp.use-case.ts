import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { verify } from 'otplib';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type {
  IUserAuthRepository,
} from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type {
  IOtpRepository,
} from '../../domain/repositories/otp.repository.interface';
import { OTP_REPOSITORY } from '../../domain/repositories/otp.repository.interface';
import type {
  IAuthSessionRepository,
} from '../../domain/repositories/auth-session.repository.interface';
import { AUTH_SESSION_REPOSITORY } from '../../domain/repositories/auth-session.repository.interface';
import { AuthSession } from '../../domain/entities/auth-session.aggregate';
import { RefreshToken } from '../../domain/value-objects/refresh-token.vo';
import {
  OtpVerifiedEvent,
  UserLoggedInEvent,
} from '../../domain/events/auth-events';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { VerifyOtpInput } from '../dtos/verify-otp.dto';

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
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepo: IAuthSessionRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
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
    if (!stored || stored.code !== dto.code) {
      await this.audit.log({
        action: 'auth.otp_failed',
        resourceType: 'USER',
        resourceId: user.id,
        metadata: { type: dto.type },
      });
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.otpRepo.markUsed(stored.id);

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

    // If TOTP is enabled, require second factor
    if (user.totpEnabled) {
      return { requiresTotp: true };
    }

    // Issue tokens
    return this.issueTokens(user);
  }

  async verifyTotpAndIssue(
    email: string,
    totpCode: string,
  ): Promise<VerifyOtpResult> {
    const traceId = this.cls.get<string>('traceId');
    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.totpSecret) {
      throw new UnauthorizedException('2FA not configured');
    }

    const valid = verify({ secret: user.totpSecret, token: totpCode });
    if (!valid) {
      await this.audit.log({
        action: 'auth.totp_failed',
        resourceType: 'USER',
        resourceId: user.id,
      });
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.audit.log({
      action: 'auth.totp_verified',
      resourceType: 'USER',
      resourceId: user.id,
    });

    return this.issueTokens(user);
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    roleIds: string[];
  }): Promise<VerifyOtpResult> {
    const accessExpiresIn = this.config.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
    );
    const refreshExpiresIn = this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );

    const payload = { email: user.email, roleIds: user.roleIds };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.parseExpiresInSeconds(accessExpiresIn),
      subject: user.id,
    });

    const refreshTokenVo = RefreshToken.generate();
    const refreshExpiresMs = this.parseExpiresIn(refreshExpiresIn);
    const session = AuthSession.create({
      id: '', // DB-generated UUID v7
      userId: user.id,
      refreshToken: refreshTokenVo,
      expiresAt: new Date(Date.now() + refreshExpiresMs),
    });

    await this.sessionRepo.save(session);

    this.eventEmitter.emit(
      'auth.login',
      new UserLoggedInEvent(user.id),
    );

    await this.audit.log({
      action: 'auth.login',
      resourceType: 'USER',
      resourceId: user.id,
    });

    this.logger.info('User logged in', {
      traceId: this.cls.get<string>('traceId'),
      userId: user.id,
    });

    return {
      requiresTotp: false,
      accessToken,
      refreshToken: refreshTokenVo.value,
      expiresIn: this.parseExpiresIn(accessExpiresIn),
    };
  }

  private parseExpiresInSeconds(value: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(value);
    if (!match) return 900;
    const num = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return num;
      case 'm': return num * 60;
      case 'h': return num * 60 * 60;
      case 'd': return num * 24 * 60 * 60;
      default: return 900;
    }
  }

  private parseExpiresIn(value: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(value);
    if (!match) return 900; // default 15m
    const num = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return num * 1000;
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      case 'd': return num * 24 * 60 * 60 * 1000;
      default: return 900 * 1000;
    }
  }
}
