import { Injectable, Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { v7 as uuidv7 } from 'uuid';
import { LoggerService } from '../../../../logger/logger.service';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../shared/cache/cache.port';
import { ContactSupport } from '../../domain/entities/contact-support.aggregate';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import type { IContactSupportRepository } from '../../domain/ports/contact-support.repository.interface';
import { ContactSupportCreatedEvent } from '../../domain/events/contact-support-created.domain-event';
import { CONTACT_SUPPORT_CACHE_PATTERN } from '../contact-support.constants';
import type { CreateContactSupportDto } from '../dtos/create-contact-support.dto';

@Injectable()
export class CreateContactSupportUseCase {
  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext(CreateContactSupportUseCase.name);
  }

  @Transactional()
  async execute(
    dto: CreateContactSupportDto,
    actorId?: string,
  ): Promise<string> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CreateContactSupportUseCase start', { traceId });

    const id = uuidv7();
    const entity = ContactSupport.create(
      id,
      dto.firstName,
      dto.lastName,
      dto.email,
      dto.phone,
      dto.subject,
      dto.message,
      dto.smsConsent,
    );

    await this.repo.save(entity);

    await this.audit.log(
      {
        action: 'contact_support.created',
        actorId,
        resourceType: 'CONTACT',
        resourceId: id,
      },
      { strict: true },
    );

    await this.cache.delByPattern(CONTACT_SUPPORT_CACHE_PATTERN);

    this.eventEmitter.emit(
      'contact-support.created',
      new ContactSupportCreatedEvent(id),
    );
    this.logger.info('CreateContactSupportUseCase end', {
      traceId,
      contactSupportId: id,
    });

    return id;
  }
}
