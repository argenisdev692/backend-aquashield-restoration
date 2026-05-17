import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { CacheService } from '../../../../shared/cache/cache.service';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { UserNotFoundException } from '../../domain/exceptions/user-domain.exception';

@Injectable()
export class DeleteUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly cache: CacheService,
  ) {}

  async execute(id: string, actorId: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('DeleteUserUseCase start', { traceId, userId: id });

    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new UserNotFoundException(id);
    }

    await this.userRepo.softDelete(id);

    await this.cache.del(`users-service:user:${id}`);
    await this.cache.delByPattern('users-service:users:list:*');

    await this.audit.log({
      action: 'users.deleted',
      resourceType: 'USER',
      resourceId: id,
      actorId,
    });

    this.logger.info('DeleteUserUseCase end', { traceId, userId: id });
  }
}
