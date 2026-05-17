import { createHash, randomBytes } from 'node:crypto';

export class SetupToken {
  private constructor(
    private readonly _raw: string | null,
    private readonly _hash: string,
  ) {}

  static generate(): SetupToken {
    const raw = randomBytes(48).toString('hex');
    return new SetupToken(raw, SetupToken.hashOf(raw));
  }

  static fromHash(hash: string): SetupToken {
    return new SetupToken(null, hash);
  }

  static hashOf(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  get raw(): string {
    if (this._raw === null) {
      throw new Error('Raw setup token is not available after persistence');
    }
    return this._raw;
  }

  get hash(): string {
    return this._hash;
  }
}
