import { Inject, Injectable } from '@nestjs/common';
import sanitize from 'sanitize-html';
import { CompanyBrandingService } from '../../../companydata/company-branding.service';
import { escapeHtml } from '../../../../shared/external/email/email-html.util';
import { MAILER } from '../../../../shared/external/email/mailer.port';
import type { IMailer } from '../../../../shared/external/email/mailer.port';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';

/**
 * Users-domain email templates.
 *
 * Builds the password-setup / password-change HTML and delegates the actual
 * delivery to the shared {@link IMailer} (Resend in prod, Console in dev).
 * The Resend SDK is NOT instantiated here — single source of truth lives in
 * `shared/external/email/`. The brand name is resolved through
 * {@link CompanyBrandingService} (CompanyData → `COMPANY_NAME` env), never a
 * hardcoded literal.
 */
@Injectable()
export class ResendEmailAdapter implements IEmailPort {
  constructor(
    @Inject(MAILER) private readonly mailer: IMailer,
    private readonly branding: CompanyBrandingService,
  ) {}

  async sendPasswordSetupLink(params: {
    to: string;
    setupLink: string;
    name: string;
    type: 'setup' | 'change';
  }): Promise<void> {
    const isSetup = params.type === 'setup';
    const subject = isSetup ? 'Set up your password' : 'Change your password';

    const safeName = sanitize(params.name, {
      allowedTags: [],
      allowedAttributes: {},
    });

    const companyName = escapeHtml(await this.branding.getCompanyName());

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>${isSetup ? 'Welcome, ' + safeName + '!' : 'Hello, ' + safeName + '!'}</h2>
        <p>
          ${
            isSetup
              ? 'Your account has been created. Click the button below to set up your password.'
              : 'You requested to change your password. Click the button below to set a new password.'
          }
        </p>
        <a href="${params.setupLink}"
           style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;
                  border-radius:6px;text-decoration:none;font-weight:bold;margin:20px 0;">
          ${isSetup ? 'Set Up Password' : 'Change Password'}
        </a>
        <p style="color:#666;font-size:14px;">
          This link expires in <strong>72 hours</strong>.
          If you did not request this, please ignore this email.
        </p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <p style="color: #6b7280; font-size: 12px;">${companyName}</p>
      </div>
    `;

    await this.mailer.send({ to: params.to, subject, html });
  }
}
