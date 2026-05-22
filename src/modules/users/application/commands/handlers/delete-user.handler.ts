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
import { UserNotFoundException } from '../../../domain/exceptions/user-domain.exception';
import { DeleteUserCommand } from '../delete-user.command';

@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<DeleteUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly cache: CacheService,
  ) {}

  async execute(command: DeleteUserCommand): Promise<void> {
    const { id } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('DeleteUserHandler start', { traceId, userId: id });

    await this.runWrite(command);

    await this.cache.del(`users-service:user:${id}`);
    await this.cache.delByPattern('users-service:users:list:*');

    this.logger.info('DeleteUserHandler end', { traceId, userId: id });
  }

  @Transactional()
  private async runWrite(command: DeleteUserCommand): Promise<void> {
    const { id, actorId } = command;

    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new UserNotFoundException(id);
    }

    await this.userRepo.softDelete(id);

    await this.audit.log(
      {
        action: 'users.deleted',
        resourceType: 'USER',
        resourceId: id,
        actorId,
      },
      { strict: true },
    );
  }
}
