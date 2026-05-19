import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { ContactSupportCreatedEvent } from '../../domain/events/contact-support-created.domain-event';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import type { IContactSupportRepository } from '../../domain/ports/contact-support.repository.interface';
import { SUPPORT_EMAIL_PORT } from '../../domain/ports/support-email.port';
import type { ISupportEmailPort } from '../../domain/ports/support-email.port';
import { ADMIN_RECIPIENTS_PORT } from '../../domain/ports/admin-recipients.port';
import type { IAdminRecipientsPort } from '../../domain/ports/admin-recipients.port';
import { ContactSupportGateway } from '../gateways/contact-support.gateway';

@Injectable()
export class ContactSupportCreatedListener {
  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    @Inject(SUPPORT_EMAIL_PORT) private readonly email: ISupportEmailPort,
    @Inject(ADMIN_RECIPIENTS_PORT)
    private readonly adminRecipients: IAdminRecipientsPort,
    private readonly gateway: ContactSupportGateway,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ContactSupportCreatedListener.name);
  }

  @OnEvent('contact-support.created', { async: true })
  async handle(event: ContactSupportCreatedEvent): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ContactSupportCreatedListener start', {
      traceId,
      requestId: event.contactSupportId,
    });

    const request = await this.repo.findById(event.contactSupportId);
    if (!request) {
      this.logger.warn('ContactSupportCreatedListener: request not found', {
        traceId,
        requestId: event.contactSupportId,
      });
      return;
    }

    try {
      const adminEmails = await this.adminRecipients.getAdminRecipientEmails();
      await this.email.notifyAdminsNewRequest({
        adminEmails,
        requestId: request.id,
        fromName: `${request.firstName} ${request.lastName}`,
        fromEmail: request.email,
        phone: request.phone,
        subject: request.subject,
        message: request.message,
      });
    } catch (err) {
      this.logger.error('Failed to send admin email notification', {
        traceId,
        requestId: event.contactSupportId,
        error: (err as Error).message,
      });
    }

    try {
      await this.email.sendSubmissionConfirmation({
        toEmail: request.email,
        toName: request.firstName,
        subject: request.subject,
      });
    } catch (err) {
      this.logger.error('Failed to send submission confirmation', {
        traceId,
        requestId: event.contactSupportId,
        error: (err as Error).message,
      });
    }

    this.gateway.broadcastNewRequest({
      id: request.id,
      firstName: request.firstName,
      lastName: request.lastName,
      email: request.email,
      phone: request.phone,
      createdAt: new Date().toISOString(),
    });

    this.logger.info('ContactSupportCreatedListener complete', {
      traceId,
      requestId: event.contactSupportId,
    });
  }
}
