import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { Resend } from 'resend';
import { type IPolicy } from 'cockatiel';
import { createExternalServicePolicy } from '../resilience';
import { LoggerService } from '../../../logger/logger.service';
import type { IMailer } from './mailer.port';
import type { SendMailParams, SendMailResult } from './mailer.types';
import { sanitizeRecipients } from './email-html.util';

/**
 * Resend implementation of {@link IMailer}.
 *
 * - Wraps every call in the `email` resilience profile (retry + circuit breaker).
 * - Skips delivery to `example.com` addresses (RFC 2606) so fixtures never escape.
 * - Logs 4xx as `warn` and 5xx as `error` — the resilience policy keeps retrying 5xx.
 * - Always tags log lines with `traceId` from CLS for cross-request correlation.
 */
@Injectable()
export class ResendMailerAdapter implements IMailer, OnModuleInit {
  private resend!: Resend;
  private from!: string;
  private resilience!: IPolicy;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ResendMailerAdapter.name);
  }

  onModuleInit(): void {
    const apiKey = this.config.getOrThrow<string>('RESEND_API_KEY');
    this.from = this.config.getOrThrow<string>('RESEND_FROM_EMAIL');
    this.resend = new Resend(apiKey);
    this.resilience = createExternalServicePolicy('resend', 'email');
  }

  async send(params: SendMailParams): Promise<SendMailResult> {
    const traceId = this.cls.get<string>('traceId');
    const recipients = sanitizeRecipients(params.to);

    if (recipients.length === 0) {
      this.logger.info(
        'Mailer skip — all recipients filtered (empty or example.com)',
        {
          traceId,
          subject: params.subject,
        },
      );
      return { delivered: false, skipped: true };
    }

    return this.resilience.execute(async () => {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: recipients,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });

      if (error) {
        const statusCode = (error as Record<string, unknown>)['statusCode'];
        const code = typeof statusCode === 'number' ? statusCode : 500;
        const logPayload = {
          traceId,
          subject: params.subject,
          recipients: recipients.length,
          statusCode: code,
          error: error.message,
        };

        if (code >= 400 && code < 500) {
          this.logger.warn('Resend 4xx — client error', logPayload);
        } else {
          this.logger.error('Resend 5xx — server error', logPayload);
        }

        throw new Error(`Email delivery failed (${code}): ${error.message}`);
      }

      this.logger.info('Email sent via Resend', {
        traceId,
        subject: params.subject,
        recipients: recipients.length,
      });
      return { delivered: true, skipped: false };
    });
  }
}
