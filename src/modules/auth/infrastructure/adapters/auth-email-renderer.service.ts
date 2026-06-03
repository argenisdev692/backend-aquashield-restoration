import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { escapeHtml } from '../../../../shared/external/email/email-html.util';
import type { AuthEmailJob } from '../jobs/auth-email-job.types';

/**
 * Pure renderer for auth transactional emails — turns an `AuthEmailJob`
 * payload into the `{ to, subject, html }` triple the shared `IMailer`
 * consumes. NO IO, NO delivery — that lives in the BullMQ processor so
 * retries / circuit breaker happen there.
 *
 * Every user-controlled value is escaped at insertion (OWASP #3 Injection).
 */
@Injectable()
export class AuthEmailRenderer {
  private readonly appName: string;
  private readonly appUrl: string;

  constructor(config: ConfigService) {
    this.appName = 'Aquashield Restoration LLC';
    this.appUrl = config.get<string>('APP_URL', 'http://localhost:4200');
  }

  render(job: AuthEmailJob): { to: string; subject: string; html: string } {
    switch (job.kind) {
      case 'email_verification':
        return {
          to: job.to,
          subject: `[${this.appName}] Verify your email`,
          html: this.layout(
            'Verify your email',
            `<p>Welcome! Use the code below to confirm your email address. It expires in <strong>${job.expiresInMinutes} minutes</strong>. If it does, request a new one from the sign-in screen.</p>` +
              this.codeBlock(job.code),
          ),
        };

      case 'password_reset_requested':
        return {
          to: job.to,
          subject: `[${this.appName}] Password reset requested`,
          html: this.layout(
            'Password reset requested',
            `<p>Someone requested a password reset for your account. Use the code below to continue. It expires in <strong>${job.expiresInMinutes} minutes</strong>.</p>` +
              this.codeBlock(job.code) +
              this.requestContext(job.ipAddress, job.userAgent) +
              `<p style="color:#b91c1c"><strong>If this wasn't you</strong>, ignore this email — your account stays safe as long as the code is not used.</p>`,
          ),
        };

      case 'password_reset_completed':
        return {
          to: job.to,
          subject: `[${this.appName}] Your password was reset`,
          html: this.layout(
            'Your password was just reset',
            `<p>Your account password was reset on <strong>${escapeHtml(job.occurredAtIso)}</strong>.</p>` +
              this.requestContext(job.ipAddress, null) +
              this.alertBlock(
                "If this wasn't you, your account may be compromised. Contact support immediately.",
              ),
          ),
        };

      case 'new_device_alert':
        return {
          to: job.to,
          subject: `[${this.appName}] New sign-in detected`,
          html: this.layout(
            'New sign-in to your account',
            `<p>We noticed a new sign-in to your account on <strong>${escapeHtml(job.occurredAtIso)}</strong>.</p>` +
              this.requestContext(job.ipAddress, job.userAgent ?? job.deviceLabel) +
              this.alertBlock(
                "If this wasn't you, change your password and revoke all sessions in your security settings.",
              ),
          ),
        };

      case 'password_changed':
        return {
          to: job.to,
          subject: `[${this.appName}] Your password was changed`,
          html: this.layout(
            'Your password was changed',
            `<p>Your account password was changed on <strong>${escapeHtml(job.occurredAtIso)}</strong>.</p>` +
              this.requestContext(job.ipAddress, null) +
              this.alertBlock(
                "If this wasn't you, reset your password immediately and contact support.",
              ),
          ),
        };

      case 'account_locked':
        return {
          to: job.to,
          subject: `[${this.appName}] Account locked after repeated failed sign-ins`,
          html: this.layout(
            'Your account is temporarily locked',
            `<p>We detected too many failed sign-in attempts and locked your account until <strong>${escapeHtml(job.lockedUntilIso)}</strong>.</p>` +
              this.requestContext(job.ipAddress, null) +
              this.alertBlock(
                "If this wasn't you, change your password as soon as the lock expires.",
              ),
          ),
        };

      case 'suspicious_activity': {
        const reasonText = {
          repeated_failed_logins: 'repeated failed sign-in attempts',
          failed_two_factor: 'repeated failed two-factor codes',
          unusual_location: 'a sign-in attempt from an unusual location',
        }[job.reason];
        return {
          to: job.to,
          subject: `[${this.appName}] Suspicious sign-in activity detected`,
          html: this.layout(
            'Unusual sign-in activity on your account',
            `<p>We detected ${escapeHtml(reasonText)} at <strong>${escapeHtml(job.occurredAtIso)}</strong> (${job.failedAttempts} attempts).</p>` +
              this.requestContext(job.ipAddress, job.userAgent) +
              this.alertBlock(
                "If this wasn't you, change your password right now and enable two-factor authentication. We will lock the account if more failed attempts follow.",
              ),
          ),
        };
      }

      case 'two_factor_enabled':
        return {
          to: job.to,
          subject: `[${this.appName}] Two-factor authentication enabled`,
          html: this.layout(
            'Two-factor authentication is now active',
            `<p>Two-factor authentication was enabled on your account.</p>` +
              this.requestContext(job.ipAddress, null) +
              this.alertBlock("If this wasn't you, contact support immediately."),
          ),
        };

      case 'two_factor_disabled':
        return {
          to: job.to,
          subject: `[${this.appName}] Two-factor authentication disabled`,
          html: this.layout(
            'Two-factor authentication was turned OFF',
            `<p>Two-factor authentication was disabled on your account.</p>` +
              this.requestContext(job.ipAddress, null) +
              this.alertBlock(
                "If this wasn't you, your account may be compromised. Reset your password and contact support.",
              ),
          ),
        };

      case 'social_account_linked':
        return {
          to: job.to,
          subject: `[${this.appName}] ${job.provider} account linked`,
          html: this.layout(
            `${job.provider} sign-in was linked to your account`,
            `<p>Your ${escapeHtml(job.provider)} account was linked on <strong>${escapeHtml(job.occurredAtIso)}</strong>.</p>` +
              this.requestContext(job.ipAddress, null) +
              this.alertBlock(
                "If this wasn't you, unlink the provider from your account settings and reset your password.",
              ),
          ),
        };
    }
  }

  // ─── HTML helpers ───────────────────────────────────────────────────────

  private layout(title: string, body: string): string {
    return `<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">${escapeHtml(title)}</h2>
      ${body}
      <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb"/>
      <p style="color:#6b7280;font-size:12px">${escapeHtml(this.appName)} · <a href="${escapeHtml(this.appUrl)}">${escapeHtml(this.appUrl)}</a></p>
    </body></html>`;
  }

  private codeBlock(code: string): string {
    return `<div style="font-family:Menlo,Consolas,monospace;font-size:28px;letter-spacing:6px;text-align:center;background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0"><strong>${escapeHtml(code)}</strong></div>`;
  }

  private requestContext(ip: string | null, ua: string | null): string {
    if (!ip && !ua) return '';
    return `<p style="color:#6b7280;font-size:13px">
      ${ip ? `IP address: <code>${escapeHtml(ip)}</code><br/>` : ''}
      ${ua ? `Device: ${escapeHtml(ua.slice(0, 160))}` : ''}
    </p>`;
  }

  private alertBlock(text: string): string {
    return `<div style="background:#fef2f2;border-left:4px solid #b91c1c;padding:12px 16px;margin-top:16px;color:#7f1d1d">${escapeHtml(text)}</div>`;
  }
}
