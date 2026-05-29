import { createHash, randomBytes } from 'node:crypto';

/**
 * Opaque refresh tokens — NOT JWTs. The raw value is returned to the
 * client once at creation / rotation; only the SHA-256 hex digest is
 * persisted in `auth_sessions.refresh_token`.
 *
 * Length: 48 bytes → 64 hex characters of effective entropy after hashing.
 * Anything longer brings no real security benefit.
 */
export const REFRESH_TOKEN_BYTES = 48;

export interface RefreshTokenPair {
  /** The opaque token returned to the client. Treat as a secret. */
  readonly raw: string;
  /** SHA-256 hex digest — what we persist. */
  readonly hash: string;
}

export function generateRefreshToken(): RefreshTokenPair {
  const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  const hash = hashRefreshToken(raw);
  return { raw, hash };
}

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/**
 * Same primitive used for the trusted-device cookie token. Kept here so the
 * crypto choice (SHA-256, base64url) stays consistent across the module.
 */
export function generateTrustedDeviceToken(): RefreshTokenPair {
  return generateRefreshToken();
}
