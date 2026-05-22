import { LogoutUseCase } from './logout.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

describe('LogoutUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('revokes the matching session and audits auth.logout', async () => {
    const sessionRepo = {
      save: jest.fn(),
      findByRefreshToken: jest
        .fn()
        .mockResolvedValue({ id: 's1', userId: 'u1' }),
      findByUserId: jest.fn(),
      revokeAllForUser: jest.fn(),
      revokeById: jest.fn().mockResolvedValue(undefined),
      revokeByIdForUser: jest.fn().mockResolvedValue(true),
      touch: jest.fn(),
      hasMatchingActiveSession: jest.fn().mockResolvedValue(true),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };

    const useCase = new LogoutUseCase(
      sessionRepo,
      audit,
      logger as never,
      cls as never,
    );

    await useCase.execute('u1', { refreshToken: 'r'.repeat(64) });

    expect(sessionRepo.revokeById).toHaveBeenCalledWith('s1');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.logout' }),
    );
    expect(logger.info).toHaveBeenCalledWith('Logout', expect.any(Object));
    expect(logger.info).toHaveBeenCalledWith(
      'User logged out',
      expect.any(Object),
    );
  });

  it('still audits logout when no refresh token is provided', async () => {
    const sessionRepo = {
      save: jest.fn(),
      findByRefreshToken: jest.fn(),
      findByUserId: jest.fn(),
      revokeAllForUser: jest.fn(),
      revokeById: jest.fn(),
    revokeByIdForUser: jest.fn().mockResolvedValue(true),
    touch: jest.fn(),
    hasMatchingActiveSession: jest.fn().mockResolvedValue(true),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };

    const useCase = new LogoutUseCase(
      sessionRepo,
      audit,
      logger as never,
      cls as never,
    );

    await useCase.execute('u1');

    expect(sessionRepo.findByRefreshToken).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.logout' }),
    );
  });
});
