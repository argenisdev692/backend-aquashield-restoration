/**
 * Port for TOTP (RFC 6238) primitives. The adapter wraps `otplib`.
 */
export interface ITotpService {
  /** Generate a fresh base32 secret (default 32 chars / 20 bytes). */
  generateSecret(): string;

  /**
   * Build a `otpauth://totp/...` URI that mobile authenticators consume to
   * provision the account. The use-case turns this into a QR code via
   * `qrcode` (in shared/) before responding to the client.
   */
  buildOtpAuthUri(input: { secret: string; accountName: string; issuer: string }): string;

  /**
   * Verify a 6-digit candidate code against the secret. Adapter applies
   * `window=1` to tolerate clock drift (one 30-second step in each direction).
   */
  verify(secret: string, candidate: string): boolean;
}

export const TOTP_SERVICE = Symbol('ITotpService');
