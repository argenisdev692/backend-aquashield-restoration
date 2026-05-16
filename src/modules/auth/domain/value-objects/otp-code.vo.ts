import { randomInt, timingSafeEqual } from 'node:crypto';

export class OtpCode {
  private constructor(
    private readonly _code: string,
    private readonly _expiresAt: Date,
  ) {}

  /** Generates a 4-digit OTP for login / email verification. */
  static generate(ttlMinutes: number = 5): OtpCode {
    const code = randomInt(0, 10_000).toString().padStart(4, '0');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    return new OtpCode(code, expiresAt);
  }

  /** Generates a 6-digit OTP for password reset (more entropy for unguarded flow). */
  static generate6(ttlMinutes: number = 10): OtpCode {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    return new OtpCode(code, expiresAt);
  }

  static from(code: string, expiresAt: Date): OtpCode {
    if (!/^\d{4,6}$/.test(code)) {
      throw new Error('OTP code must be a 4 or 6 digit string');
    }
    return new OtpCode(code, expiresAt);
  }

  /**
   * Constant-time equality check. Bails out early only on length mismatch
   * (which is independent of the secret since DTOs enforce correct length).
   */
  static safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const ab = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    return timingSafeEqual(ab, bb);
  }

  verify(input: string): boolean {
    if (this.isExpired()) return false;
    return OtpCode.safeEqual(this._code, input);
  }

  isExpired(): boolean {
    return Date.now() > this._expiresAt.getTime();
  }

  get code(): string {
    return this._code;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }
}
