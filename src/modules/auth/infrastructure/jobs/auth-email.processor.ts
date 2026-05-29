import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { LoggerService } from '../../../../logger/logger.service';
import {
  MAILER,
  type IMailer,
} from '../../../../shared/external/email/mailer.port';
import { QUEUE_NAMES } from '../../../../shared/messaging/queues.constants';
import {
  createExternalServicePolicy,
  type ExternalServiceProfile,
} from '../../../../shared/external/resilience';
import type { IPolicy } from 'cockatiel';
import { AuthEmailRenderer } from '../adapters/auth-email-renderer.service';
import type { AuthEmailJob } from './auth-email-job.types';

const POLICY_PROFILE: ExternalServiceProfile = 'email';

/**
 * Consumes the `auth-email` BullMQ queue. For each job:
 *   1. Renders the HTML via the pure `AuthEmailRenderer`.
 *   2. Delivers through the shared `IMailer` wrapped in the
 *      `createExternalServicePolicy('auth-email', 'email')` retry +
 *      circuit-breaker policy.
 *
 * BullMQ already handles job-level retries with exponential backoff (5
 * attempts, 2 s base). The cockatiel circuit breaker adds a SECOND layer
 * specific to the SMTP provider: when N consecutive jobs fail (Resend
 * outage), the breaker opens and short-circuits subsequent attempts so we
 * don't hammer the provider — letting BullMQ park the job for the next
 * backoff window. The breaker re-tests after `halfOpenAfterMs`.
 */
@Processor(QUEUE_NAMES.AUTH_EMAIL)
@Injectable()
export class AuthEmailProcessor extends WorkerHost {
  private readonly policy: IPolicy;

  constructor(
    private readonly renderer: AuthEmailRenderer,
    @Inject(MAILER) private readonly mailer: IMailer,
    private readonly logger: LoggerService,
  ) {
    super();
    this.logger.setContext(AuthEmailProcessor.name);
    this.policy = createExternalServicePolicy('auth-email', POLICY_PROFILE);
  }

  async process(job: Job<AuthEmailJob>): Promise<void> {
    const { to, subject, html } = this.renderer.render(job.data);
    const startedAt = Date.now();
    try {
      const result = await this.policy.execute(() =>
        this.mailer.send({ to, subject, html }),
      );
      this.logger.info('Auth email delivered', {
        kind: job.data.kind,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
        durationMs: Date.now() - startedAt,
        delivered: result.delivered,
        skipped: result.skipped,
      });
    } catch (err) {
      // Let BullMQ retry — re-throwing triggers the queue-level backoff.
      this.logger.warn('Auth email delivery failed (will retry)', {
        kind: job.data.kind,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
        error: (err as Error).message,
      });
      throw err;
    }
  }
}
