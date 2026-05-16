/**
 * TOTP secret value object — pure domain, zero infrastructure imports.
 *
 * Secret *generation* belongs to an infrastructure adapter (`ITotpPort`);
 * this VO only guards the invariant that a secret is well-formed.
 */
export class TotpSecret {
  private constructor(private readonly _value: string) {}

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
