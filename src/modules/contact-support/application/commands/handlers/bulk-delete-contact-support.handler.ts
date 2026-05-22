import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { BulkDeleteContactSupportCommand } from '../bulk-delete-contact-support.command';
import { CONTACT_SUPPORT_REPOSITORY } from '../../../domain/ports/contact-support.repository.interface';
import type { IContactSupportRepository } from '../../../domain/ports/contact-support.repository.interface';

@CommandHandler(BulkDeleteContactSupportCommand)
export class BulkDeleteContactSupportHandler implements ICommandHandler<BulkDeleteContactSupportCommand> {
  private static readonly CACHE_PATTERN = 'http:*:/contact-support*';

  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(BulkDeleteContactSupportHandler.name);
  }

  @Transactional()
  async execute(
    command: BulkDeleteContactSupportCommand,
  ): Promise<{ count: number }> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BulkDeleteContactSupportHandler start', {
      traceId,
      actorId: command.actorId,
      idsCount: command.ids.length,
    });

    const { count } = await this.repo.bulkDelete(command.ids);

    await this.audit.log(
      {
        action: 'contact_support.bulk_deleted',
        actorId: command.actorId,
        resourceType: 'CONTACT',
        resourceId: command.ids.length === 1 ? command.ids[0] : undefined,
        metadata: { ids: command.ids, count },
      },
      { strict: true },
    );

    await this.cache.delByPattern(
      BulkDeleteContactSupportHandler.CACHE_PATTERN,
    );

    this.logger.info('BulkDeleteContactSupportHandler end', { traceId, count });
    return { count };
  }
}
