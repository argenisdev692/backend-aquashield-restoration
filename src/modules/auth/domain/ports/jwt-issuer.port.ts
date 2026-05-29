/**
 * Port for signing and verifying access tokens. The adapter wraps
 * @nestjs/jwt. Refresh tokens are NOT JWTs — they are opaque random strings
 * (only the SHA-256 hash is stored), so this port deals only with the
 * stateless access token.
 */
export interface AccessTokenClaims {
  /** Subject — the User id. */
  readonly sub: string;
  /** AuthSession id — lets us revoke individual sessions by id. */
  readonly sid: string;
  /** Whether the underlying account requires 2FA on next sensitive op. */
  readonly twoFactor: boolean;
  /** roles[] / permissions[] live in /auth/me — not in the access token. */
}

export interface SignedAccessToken {
  readonly token: string;
  readonly expiresAt: Date;
}

export interface IJwtIssuer {
  signAccessToken(claims: AccessTokenClaims): Promise<SignedAccessToken>;
  verifyAccessToken(token: string): Promise<AccessTokenClaims>;
}

export const JWT_ISSUER = Symbol('IJwtIssuer');
