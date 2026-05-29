import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../logger/logger.service';
import type { IMailer } from './mailer.port';
import type { SendMailParams, SendMailResult } from './mailer.types';
import { sanitizeRecipients } from './email-html.util';

/**
 * No-op mailer used in local dev / E2E when `EMAIL_PROVIDER=console`.
 * Logs the would-be delivery instead of hitting Resend, so the rest of the
 * pipeline (CLS, audit, cache invalidation) still runs end-to-end.
 */
@Injectable()
export class ConsoleMailerAdapter implements IMailer {
  constructor(
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ConsoleMailerAdapter.name);
  }

  send(params: SendMailParams): Promise<SendMailResult> {
    const traceId = this.cls.get<string>('traceId');
    const recipients = sanitizeRecipients(params.to);

    if (recipients.length === 0) {
      this.logger.info('Mailer skip — no real recipients', {
        traceId,
        subject: params.subject,
      });
      return Promise.resolve({ delivered: false, skipped: true });
    }

    this.logger.info('[ConsoleMailer] Email would be sent', {
      traceId,
      subject: params.subject,
      recipients,
      htmlBytes: params.html.length,
    });
    return Promise.resolve({ delivered: true, skipped: false });
  }
}
