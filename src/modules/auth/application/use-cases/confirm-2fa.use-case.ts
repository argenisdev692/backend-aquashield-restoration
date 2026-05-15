import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { verify } from 'otplib';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type {
  IUserAuthRepository,
} from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import { TwoFactorEnabledEvent } from '../../domain/events/auth-events';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { Confirm2faInput } from '../dtos/confirm-2fa.dto';

@Injectable()
export class Confirm2faUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(Confirm2faUseCase.name);
  }

  async execute(userId: string, dto: Confirm2faInput): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Confirm 2FA', { traceId, userId });

    const user = await this.userRepo.findById(userId);
    if (!user || !user.totpSecret) {
      throw new UnauthorizedException('2FA setup not initiated');
    }

    const valid = verify({ secret: user.totpSecret, token: dto.code });
    if (!valid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.userRepo.enableTotp(userId);

    this.eventEmitter.emit(
      'auth.2fa_enabled',
      new TwoFactorEnabledEvent(userId),
    );

    await this.audit.log({
      action: 'auth.2fa_enabled',
      resourceType: 'USER',
      resourceId: userId,
    });

    this.logger.info('2FA enabled', { traceId, userId });
  }
}
