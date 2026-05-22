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
    /** Lowercased role names. Drives the per-role TTL split (admin ≠ user). */
    roleNames: string[];
  }): Promise<SignedAccessToken>;

  /**
   * Refresh-token lifetime in milliseconds (drives session `expiresAt`).
   * The roleNames argument lets the adapter shorten the window for
   * privileged accounts (admin / superadmin).
   */
  refreshTtlMs(roleNames: string[]): number;

  /** Signs a short-lived (15 min) token scoped only to the password-change flow. */
  signPasswordChangeToken(userId: string): Promise<string>;

  /**
   * Verifies a password-change token and returns the userId if valid,
   * or `null` if the token is invalid, expired, or has the wrong scope.
   */
  verifyPasswordChangeToken(token: string): Promise<string | null>;
}

export const TOKEN_SERVICE_PORT = Symbol('ITokenServicePort');
