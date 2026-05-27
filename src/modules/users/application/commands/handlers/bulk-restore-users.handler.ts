import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { CacheService } from '../../../../../shared/cache/cache.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.interface';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import { BulkRestoreUsersCommand } from '../bulk-restore-users.command';

@CommandHandler(BulkRestoreUsersCommand)
export class BulkRestoreUsersHandler implements ICommandHandler<BulkRestoreUsersCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly cache: CacheService,
  ) {}

  async execute(command: BulkRestoreUsersCommand): Promise<{ count: number }> {
    const { ids } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BulkRestoreUsersHandler start', {
      traceId,
      actorId: command.actorId,
      idsCount: ids.length,
    });

    const { count } = await this.runWrite(command);

    for (const id of ids) {
      await this.cache.del(`users-service:user:${id}`);
    }
    await this.cache.delByPattern('users-service:users:list:*');

    this.logger.info('BulkRestoreUsersHandler end', { traceId, count });
    return { count };
  }

  @Transactional()
  private async runWrite(
    command: BulkRestoreUsersCommand,
  ): Promise<{ count: number }> {
    const { ids, actorId } = command;

    const { count } = await this.userRepo.bulkRestore(ids);

    await this.audit.log(
      {
        action: 'users.bulk_restored',
        actorId,
        resourceType: 'USER',
        resourceId: ids.length === 1 ? ids[0] : undefined,
        metadata: { ids, count },
      },
      { strict: true },
    );

    return { count };
  }
}
