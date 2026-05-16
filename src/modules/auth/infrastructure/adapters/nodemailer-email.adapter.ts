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
    // Pre-rendered subject + HTML body are kept in scope so the real
    // transport integration only has to add the `transporter.sendMail()`
    // call below — no further refactor needed.
    const subject = this.getSubject(params.type);
    const body = this.getBody(params.code, params.type);

    this.logger.warn('Email transport is stubbed — OTP only logged', {
      to: params.to,
      type: params.type,
      subjectLength: subject.length,
      bodyLength: body.length,
    });

    // TODO(prod): Integrate with the real email provider (SendGrid, SES,
    // Resend, etc.). Example with nodemailer:
    //   const transporter = nodemailer.createTransport({ ... });
    //   await transporter.sendMail({ from, to: params.to, subject, html: body });
    await Promise.resolve();
  }

  private getSubject(
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

  private getBody(
    code: string,
    type: 'login' | 'email_verify' | 'password_reset',
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>${this.getSubject(type)}</h2>
        <p>Use the following code to complete your request:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; 
                    text-align: center; padding: 20px; background: #f4f4f4; 
                    border-radius: 8px; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #666; font-size: 14px;">
          This code expires in 5 minutes. If you didn't request this, please ignore this email.
        </p>
      </div>
    `;
  }
}
