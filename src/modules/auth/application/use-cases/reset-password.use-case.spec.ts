import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ResetPasswordUseCase } from './reset-password.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

function build(opts: {
  tokenValid?: boolean;
  recentHashes?: string[];
  reuseMatches?: boolean;
  breached?: boolean;
}) {
  const userRepo = {
    findByEmail: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com' }),
    findById: jest.fn(),
    findByGoogleId: jest.fn(),
    findProfileById: jest.fn(),
    create: jest.fn(),
    updateTotpSecret: jest.fn(),
    enableTotp: jest.fn(),
    disableTotp: jest.fn(),
    updatePassword: jest.fn(),
    updatePasswordWithStatus: jest.fn().mockResolvedValue(undefined),
    setMustChangePassword: jest.fn(),
    setEmailVerified: jest.fn(),
    setPasswordConfirmed: jest.fn(),
    getPasswordConfirmedAt: jest.fn(),
    setGoogleId: jest.fn(),
    updateProfile: jest.fn(),
    setLockedUntil: jest.fn(),
    clearLockedUntil: jest.fn(),
  };
  const historyRepo = {
    addEntry: jest.fn().mockResolvedValue(undefined),
    getRecent: jest.fn().mockResolvedValue(opts.recentHashes ?? []),
    pruneOldest: jest.fn().mockResolvedValue(undefined),
  };
  const resetRepo = {
    save: jest.fn(),
    findValid: jest
      .fn()
      .mockResolvedValue(
        opts.tokenValid === false ? null : { id: 'tok1', userId: 'u1' },
      ),
    markUsed: jest.fn().mockResolvedValue(undefined),
    invalidateAllForUser: jest.fn(),
  };
  const otpRepo = {
    save: jest.fn(),
    findValid: jest.fn().mockResolvedValue({ id: 'otp1', code: '123456' }),
    markUsed: jest.fn().mockResolvedValue(undefined),
  };
  const passwordHasher = {
    hash: jest.fn().mockResolvedValue('hashed'),
    compare: jest.fn().mockResolvedValue(opts.reuseMatches ?? false),
  };
  const sessionRepo = {
    save: jest.fn(),
    findByRefreshToken: jest.fn(),
    findByUserId: jest.fn(),
    revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    revokeById: jest.fn(),
    revokeByIdForUser: jest.fn().mockResolvedValue(true),
    touch: jest.fn(),
    hasMatchingActiveSession: jest.fn().mockResolvedValue(true),
  };
  const breachedPwd = {
    isBreached: jest.fn().mockResolvedValue(opts.breached ?? false),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const tx = { runInTx: jest.fn((fn: () => Promise<unknown>) => fn()) };
  const config = { get: jest.fn().mockReturnValue(90) };
  const eventEmitter = { emit: jest.fn() };

  const useCase = new ResetPasswordUseCase(
    userRepo,
    historyRepo,
    resetRepo,
    otpRepo as never,
    passwordHasher,
    breachedPwd,
    sessionRepo,
    audit,
    tx as never,
    config as never,
    eventEmitter as never,
    logger as never,
    cls as never,
  );
  return {
    useCase,
    userRepo,
    resetRepo,
    otpRepo,
    sessionRepo,
    audit,
    eventEmitter,
    breachedPwd,
  };
}

const dto = {
  resetToken: 'raw-reset-token',
  code: '123456',
  email: 'a@b.com',
  password: 'BrandNewPass1',
  passwordConfirmation: 'BrandNewPass1',
};

describe('ResetPasswordUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resets the password, consumes token+otp, revokes sessions, audits', async () => {
    const {
      useCase,
      userRepo,
      resetRepo,
      otpRepo,
      sessionRepo,
      audit,
      eventEmitter,
    } = build({});

    await useCase.execute(dto);

    expect(otpRepo.markUsed).toHaveBeenCalledWith('otp1');
    expect(resetRepo.markUsed).toHaveBeenCalledWith('tok1');
    expect(userRepo.updatePasswordWithStatus).toHaveBeenCalledTimes(1);
    expect(sessionRepo.revokeAllForUser).toHaveBeenCalledWith('u1');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.password_reset' }),
      { strict: true },
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'auth.password_reset',
      expect.anything(),
    );
    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid/expired reset token without auditing', async () => {
    const { useCase, userRepo, audit } = build({ tokenValid: false });

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(userRepo.updatePasswordWithStatus).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rejects a password that matches recent history', async () => {
    const { useCase, userRepo } = build({
      recentHashes: ['old-hash'],
      reuseMatches: true,
    });

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userRepo.updatePasswordWithStatus).not.toHaveBeenCalled();
  });

  it('rejects a breached password before persisting', async () => {
    const { useCase, userRepo } = build({ breached: true });

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userRepo.updatePasswordWithStatus).not.toHaveBeenCalled();
  });
});
