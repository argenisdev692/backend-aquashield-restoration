import { AuthSession } from './auth-session.aggregate';
import { RefreshToken } from '../value-objects/refresh-token.vo';

describe('AuthSession (domain aggregate)', () => {
  const make = (expiresAt: Date): AuthSession =>
    AuthSession.create({
      id: 'session-1',
      userId: 'user-1',
      refreshToken: RefreshToken.generate(),
      expiresAt,
    });

  it('is active when neither revoked nor expired', () => {
    const session = make(new Date(Date.now() + 60_000));
    expect(session.isActive).toBe(true);
    expect(session.isRevoked).toBe(false);
    expect(session.isExpired).toBe(false);
  });

  it('is inactive once revoked', () => {
    const session = make(new Date(Date.now() + 60_000));
    session.revoke();
    expect(session.isRevoked).toBe(true);
    expect(session.isActive).toBe(false);
  });

  it('is inactive once expired', () => {
    const session = make(new Date(Date.now() - 1000));
    expect(session.isExpired).toBe(true);
    expect(session.isActive).toBe(false);
  });

  it('reconstitutes a revoked session from persistence', () => {
    const session = AuthSession.reconstitute({
      id: 's',
      userId: 'u',
      refreshTokenHash: RefreshToken.generate().hash,
      deviceInfo: null,
      ipAddress: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      revokedAt: new Date(),
    });
    expect(session.isActive).toBe(false);
  });
});
