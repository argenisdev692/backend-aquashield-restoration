import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { CompanyBrandingService } from '../../../companydata/company-branding.service';
import { MAILER } from '../../../../shared/external/email/mailer.port';
import type { IMailer } from '../../../../shared/external/email/mailer.port';
import type {
  ICallEmailPort,
  NewCallEmailData,
} from '../../domain/ports/outbound/call-email.port.interface';
import type { RetellCallCompanyInfo } from '../../domain/ports/outbound/company-data-lookup.port.interface';
import { renderNewCallEmail } from './templates/call-email.templates';

/**
 * Renders the "New Call Recorded" admin alert and delivers it through the
 * shared {@link IMailer}. Fire-and-forget: a delivery failure is logged, never
 * thrown — a notification must never break the webhook ingest flow.
 */
@Injectable()
export class ResendCallEmailAdapter implements ICallEmailPort {
  constructor(
    @Inject(MAILER) private readonly mailer: IMailer,
    private readonly branding: CompanyBrandingService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ResendCallEmailAdapter.name);
  }

  async notifyNewCall(data: NewCallEmailData): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    // Guarantee a non-empty brand name (CompanyData → COMPANY_NAME env) so the
    // template never renders an empty brand — even when the CompanyData lookup
    // returns null (DB unavailable / singleton not configured).
    const companyName = this.branding.resolveName(data.company?.companyName);
    const company: RetellCallCompanyInfo = data.company
      ? { ...data.company, companyName }
      : {
          companyName,
          email: null,
          phone: null,
          address: null,
          website: null,
          facebookLink: null,
          instagramLink: null,
          linkedinLink: null,
          twitterLink: null,
        };
    const { subject, html } = renderNewCallEmail({ call: data.call, company });

    try {
      const result = await this.mailer.send({
        to: data.recipientEmail,
        subject,
        html,
      });
      this.logger.info('New-call notification dispatched', {
        traceId,
        callId: data.call.callId,
        delivered: result.delivered,
        skipped: result.skipped,
      });
    } catch (error) {
      this.logger.error('Failed to send new-call notification', {
        traceId,
        callId: data.call.callId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
