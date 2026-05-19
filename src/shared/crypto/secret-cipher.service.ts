import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const PREFIX = 'v1';

/**
 * Symmetric encryption for secrets at rest (e.g. TOTP seeds) — OWASP
 * Cryptographic-Failures baseline: MFA seeds must not be stored in plaintext.
 *
 * Format: `v1:<ivB64>:<authTagB64>:<cipherTextB64>` (AES-256-GCM).
 * The 32-byte key is derived from `TOTP_ENCRYPTION_KEY` via SHA-256 so any
 * sufficiently long secret string works regardless of encoding.
 *
 * `decrypt()` tolerates legacy plaintext (values without the `v1:` prefix)
 * so existing pre-encryption secrets keep working until rotated.
 */
@Injectable()
export class SecretCipher {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('TOTP_ENCRYPTION_KEY') ?? '';
    this.key = createHash('sha256').update(raw).digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      PREFIX,
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(stored: string): string {
    if (!stored.startsWith(`${PREFIX}:`)) {
      // Legacy plaintext written before encryption was introduced.
      return stored;
    }
    const [, ivB64, tagB64, ctB64] = stored.split(':');
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
