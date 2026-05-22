import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../../logger/logger.service';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';

@Injectable()
export class NodemailerEmailAdapter implements IEmailPort {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(NodemailerEmailAdapter.name);
  }

  async sendOtp(params: {
    to: string;
    code: string;
    type: 'login' | 'email_verify' | 'password_reset';
  }): Promise<void> {
    const subject = this.otpSubject(params.type);
    const body = this.otpBody(params.code, params.type, 5);
    this.logStub('sendOtp', params.to, subject, body);
    await Promise.resolve();
  }

  async sendPasswordResetCode(params: {
    to: string;
    code: string;
    name: string;
    ttlMinutes: number;
  }): Promise<void> {
    const subject = 'Your password reset code';
    const body = `
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
          If you did not request a password reset, please ignore this email and
          consider changing your password.
        </p>
      </div>
    `;
    this.logStub('sendPasswordResetCode', params.to, subject, body);
    await Promise.resolve();
  }

  async sendPasswordResetLink(params: {
    to: string;
    resetLink: string;
  }): Promise<void> {
    const subject = 'Reset your password';
    const body = `
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
    this.logStub('sendPasswordResetLink', params.to, subject, body);
    await Promise.resolve();
  }

  async sendVerificationLink(params: {
    to: string;
    verificationLink: string;
    name: string;
  }): Promise<void> {
    const subject = 'Verify your email address';
    const body = `
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
    this.logStub('sendVerificationLink', params.to, subject, body);
    await Promise.resolve();
  }

  async sendWelcomeEmail(params: { to: string; name: string }): Promise<void> {
    const subject = 'Welcome!';
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Welcome, ${params.name}!</h2>
        <p>Your account has been created successfully. We are glad to have you.</p>
      </div>
    `;
    this.logStub('sendWelcomeEmail', params.to, subject, body);
    await Promise.resolve();
  }

  async sendSecurityAlert(params: {
    to: string;
    event: 'login_attempts' | 'reset_attempts';
    attemptCount: number;
  }): Promise<void> {
    const subject =
      params.event === 'login_attempts'
        ? '⚠️ Suspicious login activity detected'
        : '⚠️ Multiple password reset attempts detected';

    const description =
      params.event === 'login_attempts'
        ? `We detected ${params.attemptCount} failed login attempts on your account.
           If this was not you, we strongly recommend changing your password immediately.`
        : `We detected ${params.attemptCount} password reset requests for your account in a short period.
           If this was not you, please be aware that someone may be trying to access your account.`;

    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;
                  border: 2px solid #dc2626; border-radius: 8px; padding: 24px;">
        <h2 style="color: #dc2626;">${subject}</h2>
        <p>${description}</p>
        <p><strong>Time:</strong> ${new Date().toUTCString()}</p>
        <p style="color: #666; font-size: 14px;">
          If this was you, no action is needed. Otherwise, secure your account immediately.
        </p>
      </div>
    `;
    this.logStub('sendSecurityAlert', params.to, subject, body);
    await Promise.resolve();
  }

  async sendNewDeviceAlert(params: {
    to: string;
    deviceLabel: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    at: Date;
  }): Promise<void> {
    const subject = 'New device sign-in detected';
    const body = `Device: ${params.deviceLabel ?? 'Unknown'} · IP: ${params.ipAddress ?? 'Unknown'} · UA: ${params.userAgent ?? 'Unknown'} · ${params.at.toUTCString()}`;
    this.logStub('sendNewDeviceAlert', params.to, subject, body);
    await Promise.resolve();
  }

  async sendPasswordChangedNotification(params: {
    to: string;
    at: Date;
    ipAddress: string | null;
    deviceLabel: string | null;
  }): Promise<void> {
    const subject = 'Your password was changed';
    const body = `When: ${params.at.toUTCString()} · IP: ${params.ipAddress ?? 'Unknown'} · Device: ${params.deviceLabel ?? 'Unknown'}`;
    this.logStub('sendPasswordChangedNotification', params.to, subject, body);
    await Promise.resolve();
  }

  private logStub(
    method: string,
    to: string,
    subject: string,
    body: string,
  ): void {
    this.logger.warn(`Email transport stubbed — ${method} only logged`, {
      to,
      subjectLength: subject.length,
      bodyLength: body.length,
    });
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

  private otpBody(
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
