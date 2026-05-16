import { createHash, randomBytes } from 'node:crypto';

/**
 * RefreshToken — domain VO carrying a freshly-generated token pair.
 *
 * Persistence stores ONLY the SHA-256 hash (`hash`). The raw value is
 * returned to the client exactly once at issue time and never re-read
 * from the database. Lookups by raw token hash the input first via
 * `RefreshToken.hashOf(raw)`.
 */
export class RefreshToken {
  private constructor(
    private readonly _raw: string | null,
    private readonly _hash: string,
  ) {}

  /** Mint a brand-new refresh token (raw + hash). */
  static generate(): RefreshToken {
    const raw = randomBytes(64).toString('hex');
    return new RefreshToken(raw, RefreshToken.hashOf(raw));
  }

  /** Rehydrate from persisted hash (raw is unavailable post-issue). */
  static fromHash(hash: string): RefreshToken {
    if (!hash || hash.length !== 64) {
      throw new Error('Invalid refresh token hash');
    }
    return new RefreshToken(null, hash);
  }

  /** Stable SHA-256 hex hash used as the storage / lookup key. */
  static hashOf(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  /** Raw token. Available only on a freshly-`generate()`d instance. */
  get raw(): string {
    if (this._raw === null) {
      throw new Error('Raw refresh token is not available after persistence');
    }
    return this._raw;
  }

  /** SHA-256 hex hash. Always available. Stored as `auth_sessions.refresh_token`. */
  get hash(): string {
    return this._hash;
  }
}
