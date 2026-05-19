import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { ContactSupportReadEvent } from '../../domain/events/contact-support-read.domain-event';
import { ContactSupportGateway } from '../gateways/contact-support.gateway';

@Injectable()
export class ContactSupportReadListener {
  constructor(
    private readonly gateway: ContactSupportGateway,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ContactSupportReadListener.name);
  }

  @OnEvent('contact-support.read', { async: true })
  handle(event: ContactSupportReadEvent): void {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ContactSupportReadListener', {
      traceId,
      requestId: event.contactSupportId,
    });
    this.gateway.broadcastRequestRead(event.contactSupportId);
  }
}
