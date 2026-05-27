import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verify } from 'otplib';
import { LoggerService } from '../../../logger/logger.service';

/**
 * otplib v13 functional API adapter.
 *
 * v13 is a rewrite: `verify()` is async and returns `{ valid, delta, epoch }`
 * (NOT a boolean as in v12). This adapter normalises it back to a boolean so
 * the application layer stays framework/library agnostic.
 */
@Injectable()
export class OtplibTotpAdapter {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(OtplibTotpAdapter.name);
  }

  generateSecret(): string {
    return generateSecret();
  }

  generateQrCode(email: string, secret: string): string {
    return generateURI({
      issuer: 'AquaShield CRM',
      label: email,
      secret: secret,
    });
  }

  async verify(token: string, secret: string): Promise<boolean> {
    const result = await verify({
      secret: secret,
      token: token,
    });
    return result.valid;
  }
}
