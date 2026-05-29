import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { escapeHtml } from '../../../../shared/external/email/email-html.util';
import { MAILER } from '../../../../shared/external/email/mailer.port';
import type { IMailer } from '../../../../shared/external/email/mailer.port';
import type { IEmailPort } from '../../domain/ports/outbound/email.port.interface';

/**
 * Appointments-domain email templates.
 *
 * Wraps the shared {@link IMailer} with the per-template HTML for
 * admin-lead notifications and submission confirmations. The generic
 * `sendEmail` passthrough is kept for callers that already render their
 * own HTML.
 */
@Injectable()
export class ResendAppointmentEmailAdapter implements IEmailPort {
  constructor(
    @Inject(MAILER) private readonly mailer: IMailer,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ResendAppointmentEmailAdapter.name);
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    try {
      await this.mailer.send(params);
    } catch (error) {
      this.logger.warn('sendEmail failed', {
        traceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async notifyAdminsNewLead(params: {
    adminEmails: string[];
    appointmentId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    message: string | null;
  }): Promise<void> {
    const traceId = this.cls.get<string>('traceId');

    const safe = {
      firstName: escapeHtml(params.firstName),
      lastName: escapeHtml(params.lastName),
      phone: escapeHtml(params.phone),
      email: escapeHtml(params.email ?? 'N/A'),
      message: escapeHtml(params.message ?? 'N/A'),
      appointmentId: escapeHtml(params.appointmentId),
    };
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">New message – appointment</h2>
        <table style="width:100%; border-collapse: collapse; background: #f8fafc; border-radius: 8px;">
          <tr>
            <td style="padding: 10px 16px; font-weight: bold; width: 120px;">Lead:</td>
            <td style="padding: 10px 16px;">${safe.firstName} ${safe.lastName}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px 16px; font-weight: bold;">Phone:</td>
            <td style="padding: 10px 16px;">${safe.phone}</td>
          </tr>
          <tr>
            <td style="padding: 10px 16px; font-weight: bold;">Email:</td>
            <td style="padding: 10px 16px;">${safe.email}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px 16px; font-weight: bold;">Appointment ID:</td>
            <td style="padding: 10px 16px; font-size: 12px; color: #64748b;">${safe.appointmentId}</td>
          </tr>
        </table>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <h3 style="color: #334155;">Message</h3>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 6px; white-space: pre-wrap; color: #334155;">
          ${safe.message}
        </div>
      </div>
    `;

    const result = await this.mailer.send({
      to: params.adminEmails,
      subject: `New message – appointment: ${params.firstName} ${params.lastName}`,
      html,
    });

    if (result.skipped) {
      this.logger.warn(
        'No mailable admin recipients (all empty or example.com) — skipped',
        { traceId, appointmentId: params.appointmentId },
      );
      return;
    }

    this.logger.info('Admin lead notification sent', {
      traceId,
      appointmentId: params.appointmentId,
    });
  }

  async sendSubmissionConfirmation(params: {
    toEmail: string;
    toName: string;
  }): Promise<void> {
    const traceId = this.cls.get<string>('traceId');

    const safe = { toName: escapeHtml(params.toName) };
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Message sent successfully</h2>
        <p style="color: #334155;">Hi ${safe.toName},</p>
        <p style="color: #334155;">
          We received your request and our team will get back to you shortly.
          Thank you for reaching out.
        </p>
      </div>
    `;

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
