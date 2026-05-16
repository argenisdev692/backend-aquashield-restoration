import { randomInt, timingSafeEqual } from 'node:crypto';

export class OtpCode {
  private constructor(
    private readonly _code: string,
    private readonly _expiresAt: Date,
  ) {}

  static generate(ttlMinutes: number = 5): OtpCode {
    // `randomInt(0, 10000)` covers the full 0000–9999 keyspace
    // (upper bound is exclusive). Zero-padding preserves the 4-digit shape.
    const code = randomInt(0, 10_000).toString().padStart(4, '0');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    return new OtpCode(code, expiresAt);
  }

  static from(code: string, expiresAt: Date): OtpCode {
    if (!/^\d{4}$/.test(code)) {
      throw new Error('OTP code must be a 4-digit string');
    }
    return new OtpCode(code, expiresAt);
  }

  /**
   * Constant-time equality check. Bails out early only on length mismatch
   * (which is independent of the secret since DTOs enforce length === 4).
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
