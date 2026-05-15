import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type {
  IAuthSessionRepository,
} from '../../domain/repositories/auth-session.repository.interface';
import { AUTH_SESSION_REPOSITORY } from '../../domain/repositories/auth-session.repository.interface';
import type {
  IUserAuthRepository,
} from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import { RefreshToken } from '../../domain/value-objects/refresh-token.vo';
import { AuthSession } from '../../domain/entities/auth-session.aggregate';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { RefreshTokenInput } from '../dtos/refresh-token.dto';

export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessionRepo: IAuthSessionRepository,
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(RefreshTokenUseCase.name);
  }

  async execute(dto: RefreshTokenInput): Promise<RefreshTokenResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Refresh token attempt', { traceId });

    const session = await this.sessionRepo.findByRefreshToken(dto.refreshToken);
    if (!session || !session.isActive) {
      throw new UnauthorizedException('Invalid or revoked refresh token');
    }

    const user = await this.userRepo.findById(session.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Revoke old session
    await this.sessionRepo.revokeById(session.id);

    // Issue new pair
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

    const newRefreshToken = RefreshToken.generate();
    const refreshExpiresMs = this.parseExpiresIn(refreshExpiresIn);
    const newSession = AuthSession.create({
      id: '',
      userId: user.id,
      refreshToken: newRefreshToken,
      expiresAt: new Date(Date.now() + refreshExpiresMs),
    });

    await this.sessionRepo.save(newSession);

    await this.audit.log({
      action: 'auth.token_refreshed',
      resourceType: 'USER',
      resourceId: user.id,
    });

    this.logger.info('Token refreshed', { traceId, userId: user.id });

    return {
      accessToken,
      refreshToken: newRefreshToken.value,
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
    if (!match) return 900;
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
