/**
 * RFC 4648 base32 secret used to seed TOTP (RFC 6238).
 * otplib defaults to 20 bytes (32 base32 chars) but we accept 16–64 chars
 * to support imported secrets from other providers.
 */
const BASE32 = /^[A-Z2-7]{16,64}=*$/;

export class InvalidTotpSecretException extends Error {
  constructor() {
    super('TOTP secret must be a base32 string (16–64 chars)');
    this.name = 'InvalidTotpSecretException';
  }
}

export class TotpSecret {
  private constructor(private readonly raw: string) {}

  static create(value: string): TotpSecret {
    if (!BASE32.test(value)) {
      throw new InvalidTotpSecretException();
    }
    return new TotpSecret(value);
  }

  static unsafeReconstitute(value: string): TotpSecret {
    return new TotpSecret(value);
  }

  reveal(): string {
    return this.raw;
  }

  toString(): string {
    return '[redacted-totp-secret]';
  }

  toJSON(): string {
    return '[redacted-totp-secret]';
  }
}
