import { Injectable } from '@nestjs/common';
import { IEmailPort } from '../../domain/ports/outbound/email.port.interface';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class ConsoleEmailAdapter implements IEmailPort {
  constructor(
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    // No-op transport: structured log only. Never dump the rendered body —
    // it carries lead PII. Swap for SendGrid/SES in production.
    this.logger.info('ConsoleEmailAdapter.sendEmail', {
      traceId,
      to: params.to,
      subject: params.subject,
    });
    return Promise.resolve();
  }
}
