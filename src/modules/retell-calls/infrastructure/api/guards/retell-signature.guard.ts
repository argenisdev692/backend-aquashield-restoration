import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import {
  RETELL_WEBHOOK_VERIFIER,
  type IRetellWebhookVerifier,
} from '../../../domain/ports/outbound/webhook-verifier.port.interface';

/**
 * Fail-closed HMAC verification of the `x-retell-signature` header against the
 * RAW request bytes (requires `rawBody: true` in main.ts). Rejects any request
 * that lacks a raw body or a valid signature. No secrets are logged.
 */
@Injectable()
export class RetellSignatureGuard implements CanActivate {
  constructor(
    @Inject(RETELL_WEBHOOK_VERIFIER)
    private readonly verifier: IRetellWebhookVerifier,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(RetellSignatureGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const traceId = this.cls.get<string>('traceId');

    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.error('Retell webhook rejected — raw body unavailable', {
        traceId,
      });
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const header = req.headers['x-retell-signature'];
    const signature = Array.isArray(header) ? header[0] : header;

    if (!this.verifier.verify(rawBody.toString('utf8'), signature)) {
      this.logger.warn('Retell webhook rejected — signature mismatch', {
        traceId,
      });
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
