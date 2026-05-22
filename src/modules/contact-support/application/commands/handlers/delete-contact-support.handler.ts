import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { DeleteContactSupportCommand } from '../delete-contact-support.command';
import { CONTACT_SUPPORT_REPOSITORY } from '../../../domain/ports/contact-support.repository.interface';
import type { IContactSupportRepository } from '../../../domain/ports/contact-support.repository.interface';

@CommandHandler(DeleteContactSupportCommand)
export class DeleteContactSupportHandler implements ICommandHandler<DeleteContactSupportCommand> {
  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(DeleteContactSupportHandler.name);
  }

  private static readonly CACHE_PATTERN = 'http:*:/contact-support*';

  @Transactional()
  async execute(command: DeleteContactSupportCommand): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('DeleteContactSupportHandler start', {
      traceId,
      id: command.id,
    });

    const entity = await this.repo.findById(command.id);
    if (!entity) throw new NotFoundException('Contact request not found');

    entity.softDelete();
    await this.repo.save(entity);

    await this.audit.log(
      {
        action: 'contact_support.deleted',
        actorId: command.actorId,
        resourceType: 'CONTACT',
        resourceId: command.id,
      },
      { strict: true },
    );

    await this.cache.delByPattern(DeleteContactSupportHandler.CACHE_PATTERN);

    this.logger.info('DeleteContactSupportHandler end', {
      traceId,
      id: command.id,
    });
  }
}
