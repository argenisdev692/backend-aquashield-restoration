import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verify } from 'otplib';
import { LoggerService } from '../../../../logger/logger.service';
import type { ITotpPort } from '../../domain/ports/outbound/totp.port';

/**
 * otplib v13 functional API adapter.
 *
 * v13 is a rewrite: `verify()` is async and returns `{ valid, delta, epoch }`
 * (NOT a boolean as in v12). This adapter normalises it back to a boolean so
 * the application layer stays framework/library agnostic.
 */
@Injectable()
export class OtplibTotpAdapter implements ITotpPort {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(OtplibTotpAdapter.name);
  }

  generateSecret(): string {
    return generateSecret();
  }

  generateUri(params: {
    issuer: string;
    label: string;
    secret: string;
  }): string {
    return generateURI({
      issuer: params.issuer,
      label: params.label,
      secret: params.secret,
    });
  }

  async verify(params: { secret: string; token: string }): Promise<boolean> {
    const result = await verify({
      secret: params.secret,
      token: params.token,
    });
    return result.valid;
  }
}
