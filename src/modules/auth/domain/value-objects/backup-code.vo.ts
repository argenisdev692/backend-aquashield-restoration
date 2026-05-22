import { randomBytes } from 'node:crypto';

/**
 * BackupCode — single-use 2FA recovery code.
 *
 * Format: XXXX-XXXX (8 chars + dash) base32-Crockford alphabet — easy to read
 * over the phone, unambiguous (no 0/O/1/I/L). The dash is cosmetic; both the
 * dashed and undashed forms verify.
 */
export class BackupCode {
  private static readonly ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  private static readonly HALF_LENGTH = 4;

  private constructor(public readonly plain: string) {}

  static generate(): BackupCode {
    const half = (): string => {
      const out: string[] = [];
      const bytes = randomBytes(BackupCode.HALF_LENGTH);
      for (let i = 0; i < BackupCode.HALF_LENGTH; i++) {
        out.push(BackupCode.ALPHABET[bytes[i] % BackupCode.ALPHABET.length]);
      }
      return out.join('');
    };
    return new BackupCode(`${half()}-${half()}`);
  }

  /** Strip dashes / whitespace / case before verifying or hashing. */
  static normalize(raw: string): string {
    return raw.replace(/[\s-]+/g, '').toUpperCase();
  }
}
