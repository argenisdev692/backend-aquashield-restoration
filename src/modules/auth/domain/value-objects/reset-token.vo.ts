import { createHash, randomBytes } from 'node:crypto';

/**
 * ResetToken — domain VO for password reset tokens.
 *
 * Persistence stores ONLY the SHA-256 hash. The raw token is embedded in
 * the reset link sent to the user's email and is never re-read from the DB.
 * Lookups use `ResetToken.hashOf(raw)` to match against stored hashes.
 */
export class ResetToken {
  private constructor(
    private readonly _raw: string | null,
    private readonly _hash: string,
  ) {}

  static generate(): ResetToken {
    const raw = randomBytes(48).toString('hex');
    return new ResetToken(raw, ResetToken.hashOf(raw));
  }

  static fromHash(hash: string): ResetToken {
    return new ResetToken(null, hash);
  }

  static hashOf(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  get raw(): string {
    if (this._raw === null) {
      throw new Error('Raw reset token is not available after persistence');
    }
    return this._raw;
  }

  get hash(): string {
    return this._hash;
  }
}
