import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { v7 as uuidv7 } from 'uuid';
import { LoggerService } from '../../../../../logger/logger.service';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { CreateContactSupportCommand } from '../create-contact-support.command';
import { ContactSupport } from '../../../domain/entities/contact-support.aggregate';
import { CONTACT_SUPPORT_REPOSITORY } from '../../../domain/ports/contact-support.repository.interface';
import type { IContactSupportRepository } from '../../../domain/ports/contact-support.repository.interface';
import { ContactSupportCreatedEvent } from '../../../domain/events/contact-support-created.domain-event';

@CommandHandler(CreateContactSupportCommand)
export class CreateContactSupportHandler implements ICommandHandler<CreateContactSupportCommand> {
  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext(CreateContactSupportHandler.name);
  }

  /** Mirrors the CacheTtlInterceptor key scheme `http:{userId}:{originalUrl}`. */
  private static readonly CACHE_PATTERN = 'http:*:/contact-support*';

  @Transactional()
  async execute(command: CreateContactSupportCommand): Promise<string> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CreateContactSupportHandler start', { traceId });

    const id = uuidv7();
    const entity = ContactSupport.create(
      id,
      command.firstName,
      command.lastName,
      command.email,
      command.phone,
      command.subject,
      command.message,
      command.smsConsent,
    );

    await this.repo.save(entity);

    await this.audit.log(
      {
        action: 'contact_support.created',
        actorId: command.actorId,
        resourceType: 'CONTACT',
        resourceId: id,
      },
      { strict: true },
    );

    await this.cache.delByPattern(CreateContactSupportHandler.CACHE_PATTERN);

    this.eventEmitter.emit(
      'contact-support.created',
      new ContactSupportCreatedEvent(id),
    );
    this.logger.info('CreateContactSupportHandler end', {
      traceId,
      contactSupportId: id,
    });

    return id;
  }
}
