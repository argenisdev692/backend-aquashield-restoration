import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { ITotpPort } from '../../domain/ports/outbound/totp.port';
import { TOTP_PORT } from '../../domain/ports/outbound/totp.port';
import { UserLoggedInEvent } from '../../domain/events/auth-events';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { VerifyTotpInput } from '../dtos/verify-totp.dto';
import { AuthTokenIssuer } from '../services/auth-token-issuer.service';

export interface VerifyTotpResult {
  requiresTotp: false;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class VerifyTotpUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(TOTP_PORT)
    private readonly totp: ITotpPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly tokenIssuer: AuthTokenIssuer,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(VerifyTotpUseCase.name);
  }

  async execute(dto: VerifyTotpInput): Promise<VerifyTotpResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Verify TOTP attempt', { traceId, email: dto.email });

    const user = await this.userRepo.findByEmail(dto.email);
    if (!user || !user.totpSecret) {
      throw new UnauthorizedException('2FA not configured');
    }

    const valid = await this.totp.verify({
      secret: user.totpSecret,
      token: dto.code,
    });
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

    const tokens = await this.tokenIssuer.issue(user);

    this.eventEmitter.emit('auth.login', new UserLoggedInEvent(user.id));
    await this.audit.log({
      action: 'auth.login',
      resourceType: 'USER',
      resourceId: user.id,
    });

    this.logger.info('User logged in via TOTP', { traceId, userId: user.id });
    return { requiresTotp: false, ...tokens };
  }
}
