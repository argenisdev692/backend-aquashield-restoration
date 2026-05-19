import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import sanitize from 'sanitize-html';
import {
  type IPolicy,
  ConsecutiveBreaker,
  ExponentialBackoff,
  circuitBreaker,
  handleAll,
  retry,
  wrap,
} from 'cockatiel';
import { LoggerService } from '../../../../logger/logger.service';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';

@Injectable()
export class ResendEmailAdapter implements IEmailPort, OnModuleInit {
  private resend!: Resend;
  private from!: string;
  private resilience!: IPolicy;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit(): void {
    const apiKey = this.config.getOrThrow<string>('RESEND_API_KEY');
    this.from = this.config.getOrThrow<string>('RESEND_FROM_EMAIL');
    this.resend = new Resend(apiKey);

    const retryPolicy = retry(handleAll, {
      maxAttempts: 2,
      backoff: new ExponentialBackoff(),
    });

    const breaker = circuitBreaker(handleAll, {
      halfOpenAfter: 30_000,
      breaker: new ConsecutiveBreaker(5),
    });

    this.resilience = wrap(retryPolicy, breaker);
  }

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
      </div>
    `;

    await this.send(params.to, subject, html);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    await this.resilience.execute(async () => {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
      });

      if (error) {
        const statusCode = (error as Record<string, unknown>)['statusCode'];
        const code = typeof statusCode === 'number' ? statusCode : 500;

        if (code >= 400 && code < 500) {
          this.logger.warn('Resend 4xx — client error', {
            to,
            subject,
            statusCode: code,
            error: error.message,
          });
        } else {
          this.logger.error('Resend 5xx — server error', {
            to,
            subject,
            statusCode: code,
            error: error.message,
          });
        }

        throw new Error(`Email delivery failed (${code}): ${error.message}`);
      }

      this.logger.info('Email sent via Resend', { to, subject });
    });
  }
}
