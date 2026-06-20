import { Inject, Injectable } from '@nestjs/common';
import { LoggerService } from '../../../../logger/logger.service';
import { CompanyBrandingService } from '../../../companydata/company-branding.service';
import {
  MAILER,
  type IMailer,
} from '../../../../shared/external/email/mailer.port';
import type { IAuthEmailService } from '../../domain/ports/auth-email.port';
import { AuthEmailRenderer } from './auth-email-renderer.service';
import type { AuthEmailJob } from '../jobs/auth-email-job.types';

/**
 * `IAuthEmailService` implementation that renders the transactional email and
 * hands it to the shared {@link IMailer} (`MAILER`), which enqueues it onto the
 * general `email` BullMQ queue. So:
 *   - the user's HTTP request returns immediately even when Resend is slow,
 *   - failures are retried by BullMQ with exponential backoff (in EmailProcessor),
 *   - delivery is wrapped in the shared circuit breaker (profile 'email'),
 *   - a Resend outage cannot cascade and lock up the auth flow.
 *
 * Rendering happens here (cheap, synchronous string building) so the queue
 * carries the generic, already-rendered `{ to, subject, html }` payload like
 * every other module — no auth-specific queue or processor.
 */
@Injectable()
export class QueuedAuthEmailAdapter implements IAuthEmailService {
  constructor(
    @Inject(MAILER) private readonly mailer: IMailer,
    private readonly renderer: AuthEmailRenderer,
    private readonly branding: CompanyBrandingService,
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
      const companyName = await this.branding.getCompanyName();
      const rendered = this.renderer.render(job, companyName);
      // MAILER (QueuedMailerAdapter) enqueues onto the general `email` queue.
      await this.mailer.send(rendered);
    } catch (err) {
      // Never throw to the caller — the auth flow must keep working even if
      // rendering or enqueue fails.
      this.logger.error('Failed to dispatch auth email', {
        kind: job.kind,
        error: (err as Error).message,
      });
    }
  }
}
