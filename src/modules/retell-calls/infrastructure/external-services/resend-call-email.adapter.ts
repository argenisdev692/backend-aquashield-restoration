import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { MAILER } from '../../../../shared/external/email/mailer.port';
import type { IMailer } from '../../../../shared/external/email/mailer.port';
import type {
  ICallEmailPort,
  NewCallEmailData,
} from '../../domain/ports/outbound/call-email.port.interface';
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
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ResendCallEmailAdapter.name);
  }

  async notifyNewCall(data: NewCallEmailData): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    const { subject, html } = renderNewCallEmail({
      call: data.call,
      company: data.company,
    });

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
