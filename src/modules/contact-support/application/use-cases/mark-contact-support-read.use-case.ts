import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../shared/cache/cache.port';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import type { IContactSupportRepository } from '../../domain/ports/contact-support.repository.interface';
import { ContactSupportReadEvent } from '../../domain/events/contact-support-read.domain-event';
import { CONTACT_SUPPORT_CACHE_PATTERN } from '../contact-support.constants';

@Injectable()
export class MarkContactSupportReadUseCase {
  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext(MarkContactSupportReadUseCase.name);
  }

  @Transactional()
  async execute(id: string, actorId: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('MarkContactSupportReadUseCase start', {
      traceId,
      id,
    });

    const entity = await this.repo.findById(id);
    if (!entity) throw new NotFoundException('Contact request not found');

    entity.markAsRead();
    await this.repo.save(entity);

    await this.audit.log(
      {
        action: 'contact_support.read',
        actorId,
        resourceType: 'CONTACT',
        resourceId: id,
      },
      { strict: true },
    );

    await this.cache.delByPattern(CONTACT_SUPPORT_CACHE_PATTERN);

    this.eventEmitter.emit(
      'contact-support.read',
      new ContactSupportReadEvent(id),
    );
    this.logger.info('MarkContactSupportReadUseCase end', {
      traceId,
      id,
    });
  }
}
