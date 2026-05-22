import { Disable2faUseCase } from './disable-2fa.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

describe('Disable2faUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('disables TOTP, emits event and audits auth.2fa_disabled', async () => {
    const userRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByGoogleId: jest.fn(),
      findProfileById: jest.fn(),
      create: jest.fn(),
      updateTotpSecret: jest.fn(),
      enableTotp: jest.fn(),
      disableTotp: jest.fn().mockResolvedValue(undefined),
      updatePassword: jest.fn(),
      updatePasswordWithStatus: jest.fn(),
      setMustChangePassword: jest.fn(),
      setEmailVerified: jest.fn(),
      setPasswordConfirmed: jest.fn(),
      getPasswordConfirmedAt: jest.fn(),
      setGoogleId: jest.fn(),
      updateProfile: jest.fn(),
    setLockedUntil: jest.fn(),
    clearLockedUntil: jest.fn(),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const eventEmitter = { emit: jest.fn() };
    const backupCodeRepo = {
      replaceAllForUser: jest.fn(),
      findUnusedByUserId: jest.fn(),
      markUsed: jest.fn(),
      deleteAllForUser: jest.fn().mockResolvedValue(undefined),
      countUnusedByUserId: jest.fn(),
    };
    const tx = { runInTx: async (fn: () => Promise<unknown>) => fn() };

    const useCase = new Disable2faUseCase(
      userRepo,
      backupCodeRepo,
      audit,
      tx as never,
      eventEmitter as never,
      logger as never,
      cls as never,
    );

    await useCase.execute('u1');

    expect(userRepo.disableTotp).toHaveBeenCalledWith('u1');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'auth.2fa_disabled',
      expect.any(Object),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.2fa_disabled' }),
      { strict: true },
    );
    expect(logger.info).toHaveBeenCalledWith('Disable 2FA', expect.any(Object));
    expect(logger.info).toHaveBeenCalledWith(
      '2FA disabled',
      expect.any(Object),
    );
  });
});
