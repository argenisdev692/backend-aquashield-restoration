/**
 * SHA-256 hex digest of a raw refresh token. We never persist the raw token —
 * only its hash lives in `auth_sessions.refresh_token`. The raw value is
 * returned to the client once at session-creation / rotation and never again.
 *
 * Hashing happens in infrastructure (`crypto` adapter); the VO just guards
 * shape so a raw token cannot accidentally be stored.
 */
const SHA256_HEX = /^[a-f0-9]{64}$/;

export class InvalidRefreshTokenHashException extends Error {
  constructor() {
    super('Refresh token hash must be a 64-char lowercase hex SHA-256 digest');
    this.name = 'InvalidRefreshTokenHashException';
  }
}

export class RefreshTokenHash {
  private constructor(public readonly value: string) {}

  static create(value: string): RefreshTokenHash {
    if (!SHA256_HEX.test(value)) {
      throw new InvalidRefreshTokenHashException();
    }
    return new RefreshTokenHash(value);
  }

  static unsafeReconstitute(value: string): RefreshTokenHash {
    return new RefreshTokenHash(value);
  }

  equals(other: RefreshTokenHash): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
