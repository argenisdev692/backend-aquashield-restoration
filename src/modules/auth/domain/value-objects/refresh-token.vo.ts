import { randomBytes } from 'node:crypto';

export class RefreshToken {
  private constructor(private readonly _value: string) {}

  static generate(): RefreshToken {
    return new RefreshToken(randomBytes(64).toString('hex'));
  }

  static from(value: string): RefreshToken {
    if (!value || value.length < 64) {
      throw new Error('Invalid refresh token');
    }
    return new RefreshToken(value);
  }

  get value(): string {
    return this._value;
  }
}
