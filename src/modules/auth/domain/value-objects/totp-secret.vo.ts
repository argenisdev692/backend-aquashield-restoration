import { generateSecret } from 'otplib';

export class TotpSecret {
  private constructor(private readonly _value: string) {}

  static generate(): TotpSecret {
    return new TotpSecret(generateSecret());
  }

  static from(value: string): TotpSecret {
    if (!value || value.length < 16) {
      throw new Error('Invalid TOTP secret');
    }
    return new TotpSecret(value);
  }

  get value(): string {
    return this._value;
  }
}
