import { TotpSecret } from './totp-secret.vo';

describe('TotpSecret (domain VO)', () => {
  it('accepts a well-formed secret', () => {
    const secret = TotpSecret.from('ABCDEFGHIJKLMNOP');
    expect(secret.value).toBe('ABCDEFGHIJKLMNOP');
  });

  it('rejects a too-short secret', () => {
    expect(() => TotpSecret.from('SHORT')).toThrow('Invalid TOTP secret');
  });

  it('rejects an empty secret', () => {
    expect(() => TotpSecret.from('')).toThrow('Invalid TOTP secret');
  });
});
