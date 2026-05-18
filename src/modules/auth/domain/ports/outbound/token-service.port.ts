/**
 * ITokenServicePort — outbound port for access-token signing.
 *
 * Keeps `@nestjs/jwt` / `@nestjs/config` out of the application layer.
 * Expiry parsing lives once inside the concrete adapter.
 */
export interface SignedAccessToken {
  token: string;
  /** Access-token lifetime in seconds (for the client `expiresIn` field). */
  expiresInSeconds: number;
}

export interface ITokenServicePort {
  signAccessToken(params: {
    userId: string;
    email: string;
    roleIds: string[];
  }): Promise<SignedAccessToken>;

  /** Refresh-token lifetime in milliseconds (drives session `expiresAt`). */
  refreshTtlMs(): number;

  /** Signs a short-lived (15 min) token scoped only to the password-change flow. */
  signPasswordChangeToken(userId: string): Promise<string>;

  /**
   * Verifies a password-change token and returns the userId if valid,
   * or `null` if the token is invalid, expired, or has the wrong scope.
   */
  verifyPasswordChangeToken(token: string): Promise<string | null>;
}

export const TOKEN_SERVICE_PORT = Symbol('ITokenServicePort');
