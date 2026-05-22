import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { LoggerService } from '../../../../logger/logger.service';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';

/** `true` when the address is on the example.com domain — never e-mailed. */
function isExampleDomain(email: string): boolean {
  const domain = email.toLowerCase().split('@').at(1) ?? '';
  return domain === 'example.com' || domain.endsWith('.example.com');
}

/** Minimal HTML escape for user-controlled fields rendered in email bodies. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class ResendEmailAdapter implements IEmailPort, OnModuleInit {
  private resend!: Resend;
  private from!: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(ResendEmailAdapter.name);
  }

  onModuleInit(): void {
    const apiKey = this.config.getOrThrow<string>('RESEND_API_KEY');
    this.from = this.config.getOrThrow<string>('RESEND_FROM_EMAIL');
    this.resend = new Resend(apiKey);
  }

  async sendOtp(params: {
    to: string;
    code: string;
    type: 'login' | 'email_verify' | 'password_reset';
  }): Promise<void> {
    if (isExampleDomain(params.to)) {
      this.logger.info('Skipping OTP email (example.com address)', { to: params.to });
      return;
    }
    const subject = this.otpSubject(params.type);
    const html = this.otpHtml(params.code, params.type, 5);
    await this.send(params.to, subject, html);
  }

  async sendPasswordResetCode(params: {
    to: string;
    code: string;
    name: string;
    ttlMinutes: number;
  }): Promise<void> {
    if (isExampleDomain(params.to)) {
      this.logger.info('Skipping password reset email (example.com address)', { to: params.to });
      return;
    }
    const subject = 'Your password reset code';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Password Reset Code</h2>
        <p>Hello ${params.name}, you requested a password reset.</p>
        <p>Enter the following 6-digit code to reset your password:</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 10px;
                    text-align: center; padding: 20px; background: #f4f4f4;
                    border-radius: 8px; margin: 20px 0;">
          ${params.code}
        </div>
        <p style="color: #666; font-size: 14px;">
          This code expires in <strong>${params.ttlMinutes} minutes</strong>.
          If you did not request a password reset, please ignore this email.
        </p>
      </div>
    `;
    await this.send(params.to, subject, html);
  }

  async sendPasswordResetLink(params: {
    to: string;
    resetLink: string;
  }): Promise<void> {
    if (isExampleDomain(params.to)) {
      this.logger.info('Skipping password reset link email (example.com address)', { to: params.to });
      return;
    }
    const subject = 'Reset your password';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <a href="${params.resetLink}"
           style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;
                  border-radius:6px;text-decoration:none;font-weight:bold;margin:20px 0;">
          Reset Password
        </a>
        <p style="color:#666;font-size:14px;">
          If you did not request a password reset, please ignore this email.
        </p>
      </div>
    `;
    await this.send(params.to, subject, html);
  }

  async sendVerificationLink(params: {
    to: string;
    verificationLink: string;
    name: string;
  }): Promise<void> {
    if (isExampleDomain(params.to)) {
      this.logger.info('Skipping verification link email (example.com address)', { to: params.to });
      return;
    }
    const subject = 'Verify your email address';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Hello, ${params.name}!</h2>
        <p>Please click the button below to verify your email address.</p>
        <a href="${params.verificationLink}"
           style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;
                  border-radius:6px;text-decoration:none;font-weight:bold;margin:20px 0;">
          Verify Email
        </a>
        <p style="color:#666;font-size:14px;">
          If you did not create an account, please ignore this email.
        </p>
      </div>
    `;
    await this.send(params.to, subject, html);
  }

  async sendWelcomeEmail(params: { to: string; name: string }): Promise<void> {
    if (isExampleDomain(params.to)) {
      this.logger.info('Skipping welcome email (example.com address)', { to: params.to });
      return;
    }
    const subject = 'Welcome!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Welcome, ${params.name}!</h2>
        <p>Your account has been created successfully. We are glad to have you.</p>
      </div>
    `;
    await this.send(params.to, subject, html);
  }

  async sendSecurityAlert(params: {
    to: string;
    event: 'login_attempts' | 'reset_attempts';
    attemptCount: number;
  }): Promise<void> {
    if (isExampleDomain(params.to)) {
      this.logger.info('Skipping security alert email (example.com address)', { to: params.to });
      return;
    }
    const subject =
      params.event === 'login_attempts'
        ? 'Suspicious login activity detected'
        : 'Multiple password reset attempts detected';

    const description =
      params.event === 'login_attempts'
        ? `We detected ${params.attemptCount} failed login attempts on your account.
           If this was not you, we strongly recommend changing your password immediately.`
        : `We detected ${params.attemptCount} password reset requests for your account in a short period.
           If this was not you, please be aware that someone may be trying to access your account.`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;
                  border: 2px solid #dc2626; border-radius: 8px; padding: 24px;">
        <h2 style="color: #dc2626;">⚠️ ${subject}</h2>
        <p>${description}</p>
        <p><strong>Time:</strong> ${new Date().toUTCString()}</p>
        <p style="color: #666; font-size: 14px;">
          If this was you, no action is needed. Otherwise, secure your account immediately.
        </p>
      </div>
    `;
    await this.send(params.to, subject, html);
  }

  async sendNewDeviceAlert(params: {
    to: string;
    deviceLabel: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    at: Date;
  }): Promise<void> {
    if (isExampleDomain(params.to)) {
      this.logger.info('Skipping new-device alert (example.com address)', { to: params.to });
      return;
    }
    const subject = 'New device sign-in detected';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;
                  border: 2px solid #f59e0b; border-radius: 8px; padding: 24px;">
        <h2 style="color: #b45309;">New device sign-in</h2>
        <p>We noticed a sign-in to your account from a device we don't recognise.</p>
        <ul style="line-height: 1.7;">
          <li><strong>Device:</strong> ${escapeHtml(params.deviceLabel ?? 'Unknown')}</li>
          <li><strong>IP address:</strong> ${escapeHtml(params.ipAddress ?? 'Unknown')}</li>
          <li><strong>User-Agent:</strong> ${escapeHtml(params.userAgent ?? 'Unknown')}</li>
          <li><strong>When:</strong> ${params.at.toUTCString()}</li>
        </ul>
        <p style="color:#666;font-size:14px;">
          If this was you, no action is needed. Otherwise change your password
          immediately and revoke this session from the active-devices screen.
        </p>
      </div>
    `;
    await this.send(params.to, subject, html);
  }

  async sendPasswordChangedNotification(params: {
    to: string;
    at: Date;
    ipAddress: string | null;
    deviceLabel: string | null;
  }): Promise<void> {
    if (isExampleDomain(params.to)) {
      this.logger.info('Skipping password-changed notification (example.com address)', { to: params.to });
      return;
    }
    const subject = 'Your password was changed';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Your password was changed</h2>
        <p>This is a confirmation that your account password was just updated.</p>
        <ul style="line-height: 1.7;">
          <li><strong>When:</strong> ${params.at.toUTCString()}</li>
          <li><strong>IP address:</strong> ${escapeHtml(params.ipAddress ?? 'Unknown')}</li>
          <li><strong>Device:</strong> ${escapeHtml(params.deviceLabel ?? 'Unknown')}</li>
        </ul>
        <p>All previous sessions have been signed out.</p>
        <p style="color:#dc2626;font-size:14px;">
          <strong>Not you?</strong> Reset your password immediately and contact support.
        </p>
      </div>
    `;
    await this.send(params.to, subject, html);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      html,
    });

    if (error) {
      this.logger.error('Resend delivery failed', {
        to,
        subject,
        error: error.message,
      });
      throw new Error(`Email delivery failed: ${error.message}`);
    }

    this.logger.info('Email sent via Resend', { to, subject });
  }

  private otpSubject(
    type: 'login' | 'email_verify' | 'password_reset',
  ): string {
    switch (type) {
      case 'login':
        return 'Your login verification code';
      case 'email_verify':
        return 'Verify your email address';
      case 'password_reset':
        return 'Password reset code';
    }
  }

  private otpHtml(
    code: string,
    type: 'login' | 'email_verify' | 'password_reset',
    ttlMinutes: number,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>${this.otpSubject(type)}</h2>
        <p>Use the following code to complete your request:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px;
                    text-align: center; padding: 20px; background: #f4f4f4;
                    border-radius: 8px; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #666; font-size: 14px;">
          This code expires in ${ttlMinutes} minutes. If you did not request this, please ignore this email.
        </p>
      </div>
    `;
  }
}
