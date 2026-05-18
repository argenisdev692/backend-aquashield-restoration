import { UnauthorizedException } from '@nestjs/common';
import { Confirm2faUseCase } from './confirm-2fa.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

function build(opts: { valid?: boolean; totpSecret?: string | null }) {
  const userRepo = {
    findByEmail: jest.fn(),
    findById: jest.fn().mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      password: 'h',
      totpSecret: opts.totpSecret === undefined ? 'SECRET' : opts.totpSecret,
      totpEnabled: false,
      roleIds: [],
      googleId: null,
      emailVerifiedAt: null,
      mustChangePassword: false,
      passwordExpiresAt: null,
    }),
    findByGoogleId: jest.fn(),
    findProfileById: jest.fn(),
    create: jest.fn(),
    updateTotpSecret: jest.fn(),
    enableTotp: jest.fn().mockResolvedValue(undefined),
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
    generateSecret: jest.fn(),
    generateUri: jest.fn(),
    verify: jest.fn().mockResolvedValue(opts.valid ?? true),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const eventEmitter = { emit: jest.fn() };

  const useCase = new Confirm2faUseCase(
    userRepo,
    totp,
    audit,
    eventEmitter as never,
    logger as never,
    cls as never,
  );
  return { useCase, userRepo, audit, eventEmitter };
}

describe('Confirm2faUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('enables TOTP, emits event and audits auth.2fa_enabled with start+end logs', async () => {
    const { useCase, userRepo, audit, eventEmitter } = build({ valid: true });

    await useCase.execute('u1', { code: '123456' });

    expect(userRepo.enableTotp).toHaveBeenCalledWith('u1');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'auth.2fa_enabled',
      expect.any(Object),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.2fa_enabled' }),
    );
    expect(logger.info).toHaveBeenCalledWith('Confirm 2FA', expect.any(Object));
    expect(logger.info).toHaveBeenCalledWith('2FA enabled', expect.any(Object));
  });

  it('throws on an invalid TOTP code', async () => {
    const { useCase, userRepo } = build({ valid: false });
    await expect(
      useCase.execute('u1', { code: '000000' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userRepo.enableTotp).not.toHaveBeenCalled();
  });

  it('throws when 2FA setup was never initiated', async () => {
    const { useCase } = build({ totpSecret: null });
    await expect(
      useCase.execute('u1', { code: '123456' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
