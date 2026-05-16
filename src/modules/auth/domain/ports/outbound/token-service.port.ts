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
}

export const TOKEN_SERVICE_PORT = Symbol('ITokenServicePort');
