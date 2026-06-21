import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import type { IPolicy } from 'cockatiel';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../logger/logger.service';
import { QUEUE_NAMES } from '../../messaging/queues.constants';
import {
  createCircuitBreakerOnlyPolicy,
  type ExternalServiceProfile,
} from '../resilience';
import type { EmailJob } from './email-job.types';
import { MAILER_TRANSPORT, type IMailer } from './mailer.port';

const POLICY_PROFILE: ExternalServiceProfile = 'email';

/**
 * Consumes the shared `email` BullMQ queue. For each job it delivers the
 * already-rendered HTML through the low-level transport ({@link IMailer}
 * bound to {@link MAILER_TRANSPORT}) wrapped in a circuit-breaker-ONLY policy
 * (`createCircuitBreakerOnlyPolicy('email', 'email')`).
 *
 * Retries are owned by ONE layer only — BullMQ's job-level `attempts` +
 * exponential `backoff`. We deliberately do NOT use the inner cockatiel retry
 * here: stacking it on top of BullMQ's attempts would multiply provider calls
 * per email. The breaker still short-circuits subsequent attempts during a
 * provider outage (N consecutive failures) so we stop hammering it; it
 * re-tests after `halfOpenAfterMs`. The instance is built once in the
 * constructor so its consecutive-failure state persists across jobs.
 *
 * Re-throwing on failure triggers the queue-level backoff.
 */
@Processor(QUEUE_NAMES.EMAIL)
@Injectable()
export class EmailProcessor extends WorkerHost {
  private readonly policy: IPolicy;

  constructor(
    @Inject(MAILER_TRANSPORT) private readonly mailer: IMailer,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    super();
    this.logger.setContext(EmailProcessor.name);
    this.policy = createCircuitBreakerOnlyPolicy('email', POLICY_PROFILE);
  }

  process(job: Job<EmailJob>): Promise<void> {
    // The worker runs outside the originating request's CLS context. Re-seed
    // the request traceId carried on the job so both these delivery logs AND
    // the transport's own `cls.get('traceId')` lines stay correlated.
    return this.cls.run(async () => {
      const traceId = job.data.traceId;
      if (traceId) {
        this.cls.set('traceId', traceId);
      }

      const startedAt = Date.now();
      try {
        const result = await this.policy.execute(() =>
          this.mailer.send(job.data),
        );
        this.logger.info('Email delivered', {
          traceId,
          jobId: job.id,
          subject: job.data.subject,
          attempt: job.attemptsMade + 1,
          durationMs: Date.now() - startedAt,
          delivered: result.delivered,
          skipped: result.skipped,
        });
      } catch (err) {
        this.logger.warn('Email delivery failed (will retry)', {
          traceId,
          jobId: job.id,
          subject: job.data.subject,
          attempt: job.attemptsMade + 1,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    });
  }
}
