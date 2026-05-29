import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verifySync } from 'otplib';
import type { ITotpService } from '../../domain/ports/totp.port';

/**
 * RFC 6238 TOTP wrapper over otplib v13 (functional API).
 *
 * `epochTolerance: 1` accepts the previous AND next 30-second step so
 * modest clock drift on the authenticator app does not lock the user out.
 */
@Injectable()
export class OtplibTotpAdapter implements ITotpService {
  generateSecret(): string {
    return generateSecret({ length: 20 }); // 20 bytes → 32 base32 chars
  }

  buildOtpAuthUri(input: {
    secret: string;
    accountName: string;
    issuer: string;
  }): string {
    return generateURI({
      strategy: 'totp',
      issuer: input.issuer,
      label: input.accountName,
      secret: input.secret,
      digits: 6,
      period: 30,
    });
  }

  verify(secret: string, candidate: string): boolean {
    if (!/^\d{6}$/.test(candidate)) return false;
    const result = verifySync({
      strategy: 'totp',
      secret,
      token: candidate,
      digits: 6,
      period: 30,
      epochTolerance: 1,
    });
    return result.valid;
  }
}
