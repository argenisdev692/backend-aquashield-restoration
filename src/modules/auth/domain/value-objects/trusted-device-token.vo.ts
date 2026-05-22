import { createHash, randomBytes } from 'node:crypto';

/**
 * Trusted-device token — the raw value lives only in the HTTP cookie. The DB
 * stores the SHA-256 hash. 32 random bytes → 256 bits of entropy.
 */
export class TrustedDeviceToken {
  private constructor(public readonly raw: string, public readonly hash: string) {}

  static generate(): TrustedDeviceToken {
    const raw = randomBytes(32).toString('base64url');
    return new TrustedDeviceToken(raw, TrustedDeviceToken.hashOf(raw));
  }

  static hashOf(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
