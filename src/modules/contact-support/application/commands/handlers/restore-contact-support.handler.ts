import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { RestoreContactSupportCommand } from '../impl/restore-contact-support.command';
import { CONTACT_SUPPORT_REPOSITORY } from '../../../domain/ports/contact-support.repository.interface';
import type { IContactSupportRepository } from '../../../domain/ports/contact-support.repository.interface';

@CommandHandler(RestoreContactSupportCommand)
export class RestoreContactSupportHandler implements ICommandHandler<RestoreContactSupportCommand> {
  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(RestoreContactSupportHandler.name);
  }

  private static readonly CACHE_PATTERN = 'http:*:/contact-support*';

  async execute(command: RestoreContactSupportCommand): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RestoreContactSupportHandler start', {
      traceId,
      id: command.id,
    });

    const entity = await this.repo.findByIdWithDeleted(command.id);
    if (!entity) throw new NotFoundException('Contact request not found');

    entity.restore();
    await this.repo.save(entity);

    await this.audit.log({
      action: 'contact_support.restored',
      actorId: command.actorId,
      resourceType: 'CONTACT',
      resourceId: command.id,
    });

    await this.cache.delByPattern(RestoreContactSupportHandler.CACHE_PATTERN);

    this.logger.info('RestoreContactSupportHandler end', {
      traceId,
      id: command.id,
    });
  }
}
