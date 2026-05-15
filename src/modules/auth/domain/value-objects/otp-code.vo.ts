import { randomInt } from 'node:crypto';

export class OtpCode {
  private constructor(
    private readonly _code: string,
    private readonly _expiresAt: Date,
  ) {}

  static generate(ttlMinutes: number = 5): OtpCode {
    const code = randomInt(1000, 9999).toString();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    return new OtpCode(code, expiresAt);
  }

  static from(code: string, expiresAt: Date): OtpCode {
    if (!/^\d{4}$/.test(code)) {
      throw new Error('OTP code must be a 4-digit string');
    }
    return new OtpCode(code, expiresAt);
  }

  verify(input: string): boolean {
    if (this.isExpired()) return false;
    return this._code === input;
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
