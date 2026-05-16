/**
 * ITotpPort — outbound port for TOTP (RFC 6238) operations.
 *
 * Keeps the `otplib` dependency out of the domain and application layers.
 * The concrete adapter lives in `infrastructure/adapters/`.
 */
export interface ITotpPort {
  generateSecret(): string;
  generateUri(params: {
    issuer: string;
    label: string;
    secret: string;
  }): string;
  verify(params: { secret: string; token: string }): Promise<boolean>;
}

export const TOTP_PORT = Symbol('ITotpPort');
