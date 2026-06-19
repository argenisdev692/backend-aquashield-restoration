import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { LoggerService } from '../../../../logger/logger.service';
import { QUEUE_NAMES } from '../../../../shared/messaging/queues.constants';
import type { IAuthEmailService } from '../../domain/ports/auth-email.port';
import type {
  AuthEmailJob,
  AuthEmailJobKind,
} from '../jobs/auth-email-job.types';

/**
 * `IAuthEmailService` implementation that simply ENQUEUES the email — the
 * actual rendering + delivery happens in `AuthEmailProcessor` so:
 *   - the user's HTTP request returns in <10 ms even when Resend is slow,
 *   - failures are retried by BullMQ with exponential backoff,
 *   - delivery is wrapped in the shared circuit breaker (profile 'email'),
 *   - a Resend outage cannot cascade and lock up the auth flow.
 *
 * Job options:
 *  - `name = job.kind` so the dashboard groups by category
 *  - `removeOnComplete`: short TTL — these jobs are personal data
 *  - `attempts: 5` with exponential backoff (queue-level default is 3, but
 *    these are safety-critical so a fifth attempt is cheap)
 */
@Injectable()
export class QueuedAuthEmailAdapter implements IAuthEmailService {
  constructor(
    @InjectQueue(QUEUE_NAMES.AUTH_EMAIL)
    private readonly queue: Queue<AuthEmailJob>,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(QueuedAuthEmailAdapter.name);
  }

  sendEmailVerification(input: {
    to: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<void> {
    return this.enqueue({
      kind: 'email_verification',
      to: input.to,
      code: input.code,
      expiresInMinutes: input.expiresInMinutes,
    });
  }

  sendPasswordResetRequested(input: {
    to: string;
    code: string;
    expiresInMinutes: number;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void> {
    return this.enqueue({
      kind: 'password_reset_requested',
      to: input.to,
      code: input.code,
      expiresInMinutes: input.expiresInMinutes,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  sendPasswordResetCompleted(input: {
    to: string;
    ipAddress: string | null;
    occurredAt: Date;
  }): Promise<void> {
    return this.enqueue({
      kind: 'password_reset_completed',
      to: input.to,
      ipAddress: input.ipAddress,
      occurredAtIso: input.occurredAt.toISOString(),
    });
  }

  sendNewDeviceAlert(input: {
    to: string;
    deviceLabel: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    occurredAt: Date;
  }): Promise<void> {
    return this.enqueue({
      kind: 'new_device_alert',
      to: input.to,
      deviceLabel: input.deviceLabel,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      occurredAtIso: input.occurredAt.toISOString(),
    });
  }

  sendPasswordChangedNotification(input: {
    to: string;
    ipAddress: string | null;
    occurredAt: Date;
  }): Promise<void> {
    return this.enqueue({
      kind: 'password_changed',
      to: input.to,
      ipAddress: input.ipAddress,
      occurredAtIso: input.occurredAt.toISOString(),
    });
  }

  sendAccountLockedNotification(input: {
    to: string;
    lockedUntil: Date;
    ipAddress: string | null;
  }): Promise<void> {
    return this.enqueue({
      kind: 'account_locked',
      to: input.to,
      lockedUntilIso: input.lockedUntil.toISOString(),
      ipAddress: input.ipAddress,
    });
  }

  sendSuspiciousActivityAlert(input: {
    to: string;
    reason: 'repeated_failed_logins' | 'failed_two_factor' | 'unusual_location';
    failedAttempts: number;
    ipAddress: string | null;
    userAgent: string | null;
    occurredAt: Date;
  }): Promise<void> {
    return this.enqueue({
      kind: 'suspicious_activity',
      to: input.to,
      reason: input.reason,
      failedAttempts: input.failedAttempts,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      occurredAtIso: input.occurredAt.toISOString(),
    });
  }

  sendTwoFactorEnabledNotification(input: {
    to: string;
    ipAddress: string | null;
  }): Promise<void> {
    return this.enqueue({
      kind: 'two_factor_enabled',
      to: input.to,
      ipAddress: input.ipAddress,
    });
  }

  sendTwoFactorDisabledNotification(input: {
    to: string;
    ipAddress: string | null;
  }): Promise<void> {
    return this.enqueue({
      kind: 'two_factor_disabled',
      to: input.to,
      ipAddress: input.ipAddress,
    });
  }

  sendSocialAccountLinked(input: {
    to: string;
    provider: 'google';
    ipAddress: string | null;
    occurredAt: Date;
  }): Promise<void> {
    return this.enqueue({
      kind: 'social_account_linked',
      to: input.to,
      provider: input.provider,
      ipAddress: input.ipAddress,
      occurredAtIso: input.occurredAt.toISOString(),
    });
  }

  // ─── helper ─────────────────────────────────────────────────────────────

  private async enqueue(job: AuthEmailJob): Promise<void> {
    try {
      await this.queue.add(job.kind satisfies AuthEmailJobKind, job, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600, count: 500 },
        removeOnFail: { age: 24 * 3600 },
      });
    } catch (err) {
      // Enqueue failure is a real problem (Redis down) — log but never throw
      // to the caller; the auth flow must keep working.
      this.logger.error('Failed to enqueue auth email job', {
        kind: job.kind,
        error: (err as Error).message,
      });
    }
  }
}
