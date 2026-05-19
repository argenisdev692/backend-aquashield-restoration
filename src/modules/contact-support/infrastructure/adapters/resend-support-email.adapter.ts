import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { Resend } from 'resend';
import { LoggerService } from '../../../../logger/logger.service';
import type { ISupportEmailPort } from '../../domain/ports/support-email.port';

/** Escape untrusted text before interpolation into an HTML email body (OWASP #3). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** `true` when the address is on the example.com domain — never e-mailed. */
function isExampleDomain(email: string): boolean {
  const domain = email.toLowerCase().split('@').at(1) ?? '';
  return domain === 'example.com' || domain.endsWith('.example.com');
}

@Injectable()
export class ResendSupportEmailAdapter
  implements ISupportEmailPort, OnModuleInit
{
  private resend!: Resend;
  private from!: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ResendSupportEmailAdapter.name);
  }

  onModuleInit(): void {
    const apiKey = this.config.getOrThrow<string>('RESEND_API_KEY');
    this.from = this.config.getOrThrow<string>('RESEND_FROM_EMAIL');
    this.resend = new Resend(apiKey);
  }

  async notifyAdminsNewRequest(params: {
    adminEmails: string[];
    requestId: string;
    fromName: string;
    fromEmail: string;
    phone: string;
    subject: string;
    message: string;
  }): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    const recipients = params.adminEmails.filter((e) => !isExampleDomain(e));

    if (recipients.length === 0) {
      this.logger.warn(
        'No mailable admin recipients (all empty or example.com) — skipping',
        { traceId, requestId: params.requestId },
      );
      return;
    }

    const safe = {
      fromName: escapeHtml(params.fromName),
      fromEmail: escapeHtml(params.fromEmail),
      phone: escapeHtml(params.phone),
      subject: escapeHtml(params.subject),
      message: escapeHtml(params.message),
      requestId: escapeHtml(params.requestId),
    };
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">New message – contact support</h2>
        <table style="width:100%; border-collapse: collapse; background: #f8fafc; border-radius: 8px;">
          <tr>
            <td style="padding: 10px 16px; font-weight: bold; width: 120px;">From:</td>
            <td style="padding: 10px 16px;">${safe.fromName} &lt;${safe.fromEmail}&gt;</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px 16px; font-weight: bold;">Phone:</td>
            <td style="padding: 10px 16px;">${safe.phone}</td>
          </tr>
          <tr>
            <td style="padding: 10px 16px; font-weight: bold;">Subject:</td>
            <td style="padding: 10px 16px;">${safe.subject}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px 16px; font-weight: bold;">Request ID:</td>
            <td style="padding: 10px 16px; font-size: 12px; color: #64748b;">${safe.requestId}</td>
          </tr>
        </table>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <h3 style="color: #334155;">Message</h3>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 6px; white-space: pre-wrap; color: #334155;">
          ${safe.message}
        </div>
      </div>
    `;

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: recipients,
      subject: `New message – contact support: ${params.subject}`,
      html,
    });

    if (error) {
      this.logger.error('Failed to send admin contact notification', {
        traceId,
        requestId: params.requestId,
        error: error.message,
      });
      throw new Error(`Email delivery failed: ${error.message}`);
    }

    this.logger.info('Admin contact notification sent', {
      traceId,
      requestId: params.requestId,
      recipients: recipients.length,
    });
  }

  async sendSubmissionConfirmation(params: {
    toEmail: string;
    toName: string;
    subject: string;
  }): Promise<void> {
    const traceId = this.cls.get<string>('traceId');

    if (isExampleDomain(params.toEmail)) {
      this.logger.info(
        'Skipping submission confirmation (example.com address)',
        { traceId },
      );
      return;
    }

    const safe = {
      toName: escapeHtml(params.toName),
      subject: escapeHtml(params.subject),
    };
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Message sent successfully</h2>
        <p style="color: #334155;">Hi ${safe.toName},</p>
        <p style="color: #334155;">
          We received your message regarding
          "<strong>${safe.subject}</strong>" and our team will get back to
          you shortly. Thank you for reaching out.
        </p>
      </div>
    `;

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: params.toEmail,
      subject: 'Message sent successfully',
      html,
    });

    if (error) {
      // A failed confirmation must not break the request flow — log and move on.
      this.logger.warn('Failed to send submission confirmation', {
        traceId,
        error: error.message,
      });
      return;
    }

    this.logger.info('Submission confirmation sent', { traceId });
  }
}
