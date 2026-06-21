import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../logger/logger.service';
import type { IMailer } from './mailer.port';
import type { SendMailParams, SendMailResult } from './mailer.types';
import { resolveRecipientsOrSkip } from './mailer-recipients';

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
    const resolution = resolveRecipientsOrSkip(params, this.logger, traceId);
    if ('skip' in resolution) {
      return Promise.resolve(resolution.skip);
    }
    const { recipients } = resolution;

    this.logger.info('[ConsoleMailer] Email would be sent', {
      traceId,
      subject: params.subject,
      recipients,
      htmlBytes: params.html.length,
    });
    return Promise.resolve({ delivered: true, skipped: false });
  }
}
