import { SetupToken } from './setup-token.vo';

describe('SetupToken (domain VO)', () => {
  it('generates a token with a raw value and its SHA-256 hash', () => {
    const token = SetupToken.generate();
    expect(token.raw).toHaveLength(96); // 48 bytes → hex
    expect(token.hash).toHaveLength(64); // SHA-256 → hex
    expect(token.hash).toBe(SetupToken.hashOf(token.raw));
  });

  it('throws when accessing raw on a hash-only token', () => {
    const token = SetupToken.fromHash('abc123');
    expect(token.hash).toBe('abc123');
    expect(() => token.raw).toThrow(
      'Raw setup token is not available after persistence',
    );
  });

  it('hashOf is deterministic', () => {
    const hash1 = SetupToken.hashOf('test-input');
    const hash2 = SetupToken.hashOf('test-input');
    expect(hash1).toBe(hash2);
  });
});
