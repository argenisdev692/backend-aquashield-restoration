import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { ITransactionManager } from '../../../../shared/database/transaction-manager.port';
import { TRANSACTION_MANAGER } from '../../../../shared/database/transaction-manager.port';
import type { UpdateProfileInput } from '../dtos/update-profile.dto';

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER)
    private readonly tx: ITransactionManager,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(UpdateProfileUseCase.name);
  }

  async execute(userId: string, dto: UpdateProfileInput): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('UpdateProfile start', { traceId, userId });

    await this.tx.runInTx(async () => {
      await this.userRepo.updateProfile(userId, dto);
      await this.audit.log(
        {
          action: 'profile.updated',
          resourceType: 'USER',
          resourceId: userId,
        },
        { strict: true },
      );
    });

    this.eventEmitter.emit('profile.updated', { userId });

    this.logger.info('UpdateProfile end', { traceId, userId });
  }
}
