import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { RetellCallRecordedEvent } from '../../domain/events/retell-call-recorded.domain-event';
import {
  RETELL_CALL_REPOSITORY,
  type IRetellCallRepository,
} from '../../domain/repositories/retell-call-repository.interface';
import {
  CALL_EMAIL_PORT,
  type ICallEmailPort,
} from '../../domain/ports/outbound/call-email.port.interface';
import {
  COMPANY_DATA_LOOKUP_PORT,
  type ICompanyDataLookupPort,
} from '../../domain/ports/outbound/company-data-lookup.port.interface';

/**
 * On a brand-new Retell call → email the company inbox (`companydata.email`)
 * with the "New Call Recorded" alert + recording link. Fully fire-and-forget:
 * any failure is logged, never thrown.
 */
@Injectable()
export class CallRecordedEmailListener {
  constructor(
    @Inject(RETELL_CALL_REPOSITORY)
    private readonly repo: IRetellCallRepository,
    @Inject(CALL_EMAIL_PORT) private readonly email: ICallEmailPort,
    @Inject(COMPANY_DATA_LOOKUP_PORT)
    private readonly companyLookup: ICompanyDataLookupPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(CallRecordedEmailListener.name);
  }

  @OnEvent(RetellCallRecordedEvent.eventName)
  async handle(event: RetellCallRecordedEvent): Promise<void> {
    const traceId = this.cls.get<string>('traceId');

    const call = await this.repo.findById(event.recordId, true);
    if (!call) {
      this.logger.warn('Recorded call not found for notification', {
        traceId,
        recordId: event.recordId,
      });
      return;
    }

    const company = await this.companyLookup.getCompanyInfo();
    const recipient = company?.email;
    if (!recipient) {
      this.logger.warn(
        'No company email configured — skipping new-call alert',
        {
          traceId,
          recordId: event.recordId,
        },
      );
      return;
    }

    await this.email.notifyNewCall({
      recipientEmail: recipient,
      call,
      company,
    });
  }
}
