import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { MarkContactSupportReadCommand } from '../mark-contact-support-read.command';
import { CONTACT_SUPPORT_REPOSITORY } from '../../../domain/ports/contact-support.repository.interface';
import type { IContactSupportRepository } from '../../../domain/ports/contact-support.repository.interface';
import { ContactSupportReadEvent } from '../../../domain/events/contact-support-read.domain-event';

@CommandHandler(MarkContactSupportReadCommand)
export class MarkContactSupportReadHandler implements ICommandHandler<MarkContactSupportReadCommand> {
  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext(MarkContactSupportReadHandler.name);
  }

  private static readonly CACHE_PATTERN = 'http:*:/contact-support*';

  @Transactional()
  async execute(command: MarkContactSupportReadCommand): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('MarkContactSupportReadHandler start', {
      traceId,
      id: command.id,
    });

    const entity = await this.repo.findById(command.id);
    if (!entity) throw new NotFoundException('Contact request not found');

    entity.markAsRead();
    await this.repo.save(entity);

    await this.audit.log(
      {
        action: 'contact_support.read',
        actorId: command.actorId,
        resourceType: 'CONTACT',
        resourceId: command.id,
      },
      { strict: true },
    );

    await this.cache.delByPattern(MarkContactSupportReadHandler.CACHE_PATTERN);

    this.eventEmitter.emit(
      'contact-support.read',
      new ContactSupportReadEvent(command.id),
    );
    this.logger.info('MarkContactSupportReadHandler end', {
      traceId,
      id: command.id,
    });
  }
}
