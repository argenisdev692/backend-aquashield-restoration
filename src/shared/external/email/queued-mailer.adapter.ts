import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../logger/logger.service';
import { QUEUE_NAMES } from '../../messaging/queues.constants';
import { sanitizeRecipients } from './email-html.util';
import { EMAIL_JOB_NAME, type EmailJob } from './email-job.types';
import { MAILER_TRANSPORT, type IMailer } from './mailer.port';
import type { SendMailParams, SendMailResult } from './mailer.types';

/**
 * Default {@link IMailer} bound to the public `MAILER` token. Instead of
 * delivering inline, it ENQUEUES every email onto the shared `email` BullMQ
 * queue so:
 *   - the caller's HTTP request / event handler returns immediately even when
 *     the provider is slow,
 *   - failures are retried by BullMQ with exponential backoff,
 *   - actual delivery (in {@link EmailProcessor}) is wrapped in the shared
 *     circuit breaker (profile 'email'),
 *   - a provider outage cannot cascade into the request path.
 *
 * Every existing module adapter (users / contact-support / appointments /
 * retell-calls) keeps injecting `MAILER` and calling `send()` — they become
 * queued for free, with no code change.
 *
 * Fallbacks (mail is NEVER silently dropped):
 *   - `EMAIL_QUEUE_ENABLED=false` (dev / E2E without a worker) → deliver
 *     synchronously through the transport.
 *   - enqueue throws (Redis down) → best-effort synchronous transport delivery.
 */
@Injectable()
export class QueuedMailerAdapter implements IMailer {
  private readonly queueEnabled: boolean;

  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL)
    private readonly queue: Queue<EmailJob>,
    @Inject(MAILER_TRANSPORT) private readonly transport: IMailer,
    config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(QueuedMailerAdapter.name);
    this.queueEnabled = config.get<boolean>('EMAIL_QUEUE_ENABLED', true);
  }

  async send(params: SendMailParams): Promise<SendMailResult> {
    const traceId = this.cls.get<string>('traceId');
    const recipients = sanitizeRecipients(params.to);

    if (recipients.length === 0) {
      this.logger.info(
        'Mailer skip — all recipients filtered (empty or example.com)',
        { traceId, subject: params.subject },
      );
      return { delivered: false, skipped: true };
    }

    if (!this.queueEnabled) {
      return this.transport.send(params);
    }

    try {
      await this.queue.add(
        EMAIL_JOB_NAME,
        {
          to: recipients,
          subject: params.subject,
          html: params.html,
          text: params.text,
          traceId,
        },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 3600, count: 500 },
          removeOnFail: { age: 24 * 3600 },
        },
      );
      this.logger.info('Email enqueued', {
        traceId,
        subject: params.subject,
        recipients: recipients.length,
      });
      // Accepted for delivery — the actual provider result is resolved by the
      // worker. Not skipped: there are real recipients.
      return { delivered: true, skipped: false };
    } catch (err) {
      // Redis unreachable: fall back to a synchronous send so the email is not
      // lost. The transport carries its own retry + circuit breaker.
      this.logger.warn(
        'Failed to enqueue email — falling back to direct send',
        {
          traceId,
          subject: params.subject,
          error: err instanceof Error ? err.message : String(err),
        },
      );
      return this.transport.send(params);
    }
  }
}
