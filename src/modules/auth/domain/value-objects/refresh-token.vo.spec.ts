import { createHash } from 'node:crypto';
import { RefreshToken } from './refresh-token.vo';

describe('RefreshToken (domain VO)', () => {
  it('generates a long opaque hex raw token and a matching SHA-256 hash', () => {
    const token = RefreshToken.generate();
    expect(token.raw).toMatch(/^[0-9a-f]+$/);
    expect(token.raw.length).toBeGreaterThanOrEqual(64);
    expect(token.hash).toMatch(/^[0-9a-f]{64}$/);
    const expected = createHash('sha256')
      .update(token.raw, 'utf8')
      .digest('hex');
    expect(token.hash).toBe(expected);
  });

  it('rebuilds from a stored hash but the raw is no longer recoverable', () => {
    const original = RefreshToken.generate();
    const rebuilt = RefreshToken.fromHash(original.hash);
    expect(rebuilt.hash).toBe(original.hash);
    expect(() => rebuilt.raw).toThrow(
      'Raw refresh token is not available after persistence',
    );
  });

  it('hashOf is stable for the same input', () => {
    const a = RefreshToken.hashOf('the-raw-token');
    const b = RefreshToken.hashOf('the-raw-token');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('rejects an invalid hash length on rehydrate', () => {
    expect(() => RefreshToken.fromHash('short')).toThrow(
      'Invalid refresh token hash',
    );
  });
});
