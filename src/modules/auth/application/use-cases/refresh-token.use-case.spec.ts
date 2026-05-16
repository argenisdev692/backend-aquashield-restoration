import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenUseCase } from './refresh-token.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

function build(opts: { active?: boolean; sessionFound?: boolean }) {
  const session = {
    id: 's1',
    userId: 'u1',
    isActive: opts.active ?? true,
  };
  const sessionRepo = {
    save: jest.fn(),
    findByRefreshToken: jest
      .fn()
      .mockResolvedValue(opts.sessionFound === false ? null : session),
    findByUserId: jest.fn(),
    revokeAllForUser: jest.fn(),
    revokeById: jest.fn().mockResolvedValue(undefined),
  };
  const userRepo = {
    findByEmail: jest.fn(),
    findById: jest.fn().mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      password: 'h',
      totpSecret: null,
      totpEnabled: false,
      roleIds: ['r1'],
      googleId: null,
      emailVerifiedAt: null,
    }),
    findByGoogleId: jest.fn(),
    findProfileById: jest.fn(),
    create: jest.fn(),
    updateTotpSecret: jest.fn(),
    enableTotp: jest.fn(),
    disableTotp: jest.fn(),
    updatePassword: jest.fn(),
    setEmailVerified: jest.fn(),
    setPasswordConfirmed: jest.fn(),
    getPasswordConfirmedAt: jest.fn(),
    setGoogleId: jest.fn(),
    updateProfile: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const tokenIssuer = {
    issue: jest.fn().mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 900,
    }),
  };
  // ITransactionManager mock: invoke the callback synchronously — unit
  // tests don't exercise rollback semantics, only the call ordering.
  const tx = {
    runInTx: jest.fn((fn: () => Promise<unknown>) => fn()),
  };

  const useCase = new RefreshTokenUseCase(
    sessionRepo,
    userRepo,
    audit,
    tx as never,
    tokenIssuer as never,
    logger as never,
    cls as never,
  );
  return { useCase, sessionRepo, audit, tokenIssuer, tx };
}

describe('RefreshTokenUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rotates the session and audits auth.token_refreshed', async () => {
    const { useCase, sessionRepo, audit, tokenIssuer } = build({});

    const result = await useCase.execute({ refreshToken: 'r'.repeat(64) });

    expect(sessionRepo.revokeById).toHaveBeenCalledWith('s1');
    expect(tokenIssuer.issue).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 900,
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.token_refreshed' }),
    );
  });

  it('throws on a revoked/expired session', async () => {
    const { useCase, tokenIssuer } = build({ active: false });
    await expect(
      useCase.execute({ refreshToken: 'r'.repeat(64) }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokenIssuer.issue).not.toHaveBeenCalled();
  });
});
