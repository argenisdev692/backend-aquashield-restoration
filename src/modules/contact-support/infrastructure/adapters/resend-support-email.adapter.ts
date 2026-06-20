import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { CompanyBrandingService } from '../../../companydata/company-branding.service';
import { escapeHtml } from '../../../../shared/external/email/email-html.util';
import { MAILER } from '../../../../shared/external/email/mailer.port';
import type { IMailer } from '../../../../shared/external/email/mailer.port';
import type { ISupportEmailPort } from '../../domain/ports/support-email.port';

/**
 * Contact-support email templates.
 *
 * Builds notification + acknowledgement HTML and delegates delivery to the
 * shared {@link IMailer}. Per-template logs preserve the previous behavior
 * (admin notifications throw on failure, confirmations are best-effort).
 */
@Injectable()
export class ResendSupportEmailAdapter implements ISupportEmailPort {
  constructor(
    @Inject(MAILER) private readonly mailer: IMailer,
    private readonly branding: CompanyBrandingService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ResendSupportEmailAdapter.name);
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
    const companyName = escapeHtml(await this.branding.getCompanyName());

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
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <p style="color: #6b7280; font-size: 12px;">${companyName}</p>
      </div>
    `;

    const result = await this.mailer.send({
      to: params.adminEmails,
      subject: `New message – contact support: ${params.subject}`,
      html,
    });

    if (result.skipped) {
      this.logger.warn(
        'No mailable admin recipients (all empty or example.com) — skipped',
        { traceId, requestId: params.requestId },
      );
      return;
    }

    this.logger.info('Admin contact notification sent', {
      traceId,
      requestId: params.requestId,
    });
  }

  async sendSubmissionConfirmation(params: {
    toEmail: string;
    toName: string;
    subject: string;
  }): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    const companyName = escapeHtml(await this.branding.getCompanyName());

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
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <p style="color: #6b7280; font-size: 12px;">${companyName}</p>
      </div>
    `;

    // Best-effort: a failed confirmation must NEVER break the request flow.
    try {
      await this.mailer.send({
        to: params.toEmail,
        subject: 'Message sent successfully',
        html,
      });
      this.logger.info('Submission confirmation sent', { traceId });
    } catch (error) {
      this.logger.warn('Failed to send submission confirmation', {
        traceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
