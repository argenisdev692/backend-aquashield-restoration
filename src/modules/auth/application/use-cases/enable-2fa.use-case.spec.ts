import { Enable2faUseCase } from './enable-2fa.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

describe('Enable2faUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists the secret, audits auth.2fa_initiated and logs start AND end', async () => {
    const userRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByGoogleId: jest.fn(),
      findProfileById: jest.fn(),
      create: jest.fn(),
      updateTotpSecret: jest.fn().mockResolvedValue(undefined),
      enableTotp: jest.fn(),
      disableTotp: jest.fn(),
      updatePassword: jest.fn(),
      updatePasswordWithStatus: jest.fn(),
      setMustChangePassword: jest.fn(),
      setEmailVerified: jest.fn(),
      setPasswordConfirmed: jest.fn(),
      getPasswordConfirmedAt: jest.fn(),
      setGoogleId: jest.fn(),
      updateProfile: jest.fn(),
    };
    const totp = {
      generateSecret: jest.fn().mockReturnValue('ABCDEFGHIJKLMNOP'),
      generateUri: jest.fn().mockReturnValue('otpauth://totp/...'),
      verify: jest.fn(),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };

    const useCase = new Enable2faUseCase(
      userRepo,
      totp,
      audit,
      logger as never,
      cls as never,
    );

    const result = await useCase.execute('u1', 'a@b.com');

    expect(result).toEqual({
      secret: 'ABCDEFGHIJKLMNOP',
      qrCodeUri: 'otpauth://totp/...',
    });
    expect(userRepo.updateTotpSecret).toHaveBeenCalledWith(
      'u1',
      'ABCDEFGHIJKLMNOP',
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.2fa_initiated' }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Enable 2FA initiated',
      expect.any(Object),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Enable 2FA completed',
      expect.any(Object),
    );
  });
});
