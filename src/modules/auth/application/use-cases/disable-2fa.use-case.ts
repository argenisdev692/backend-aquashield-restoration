import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type {
  IUserAuthRepository,
} from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import { TwoFactorDisabledEvent } from '../../domain/events/auth-events';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';

@Injectable()
export class Disable2faUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(Disable2faUseCase.name);
  }

  async execute(userId: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Disable 2FA', { traceId, userId });

    await this.userRepo.disableTotp(userId);

    this.eventEmitter.emit(
      'auth.2fa_disabled',
      new TwoFactorDisabledEvent(userId),
    );

    await this.audit.log({
      action: 'auth.2fa_disabled',
      resourceType: 'USER',
      resourceId: userId,
    });

    this.logger.info('2FA disabled', { traceId, userId });
  }
}
