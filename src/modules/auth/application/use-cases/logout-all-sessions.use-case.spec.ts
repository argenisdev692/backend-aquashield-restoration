import { LogoutAllSessionsUseCase } from './logout-all-sessions.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

describe('LogoutAllSessionsUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('revokes every session and audits auth.logout_all with start+end logs', async () => {
    const sessionRepo = {
      save: jest.fn(),
      findByRefreshToken: jest.fn(),
      findByUserId: jest.fn(),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
      revokeById: jest.fn(),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };

    const useCase = new LogoutAllSessionsUseCase(
      sessionRepo,
      audit,
      logger as never,
      cls as never,
    );

    await useCase.execute('u1');

    expect(sessionRepo.revokeAllForUser).toHaveBeenCalledWith('u1');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.logout_all' }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Logout all sessions',
      expect.any(Object),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'All sessions revoked',
      expect.any(Object),
    );
  });
});
