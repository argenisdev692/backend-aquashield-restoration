import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ChangeExpiredPasswordUseCase } from './change-expired-password.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

function build(opts: {
  userId?: string | null;
  mustChangePassword?: boolean;
  passwordExpiresAt?: Date | null;
  recentHashes?: string[];
  reuseMatches?: boolean;
  breached?: boolean;
}) {
  const userId = opts.userId === undefined ? 'u1' : opts.userId;

  const userRepo = {
    findByEmail: jest.fn(),
    findById: jest.fn().mockResolvedValue(
      userId
        ? {
            id: userId,
            email: 'a@b.com',
            password: 'h',
            totpSecret: null,
            totpEnabled: false,
            roleIds: ['r1'],
            googleId: null,
            emailVerifiedAt: null,
            mustChangePassword: opts.mustChangePassword ?? true,
            passwordExpiresAt: opts.passwordExpiresAt ?? null,
          }
        : null,
    ),
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
  const passwordHasher = {
    hash: jest.fn().mockResolvedValue('new-hash'),
    compare: jest.fn().mockResolvedValue(opts.reuseMatches ?? false),
  };
  const tokenService = {
    signAccessToken: jest.fn(),
    refreshTtlMs: jest.fn(),
    signPasswordChangeToken: jest.fn(),
    verifyPasswordChangeToken: jest
      .fn()
      .mockResolvedValue(userId === null ? null : (userId ?? null)),
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
  const tx = {
    runInTx: jest.fn((fn: () => Promise<unknown>) => fn()),
  };
  const tokenIssuer = {
    issue: jest.fn().mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 900,
    }),
  };
  const config = { get: jest.fn().mockReturnValue(90) };
  const eventEmitter = { emit: jest.fn() };

  const useCase = new ChangeExpiredPasswordUseCase(
    userRepo,
    historyRepo,
    passwordHasher,
    breachedPwd,
    tokenService,
    sessionRepo,
    audit,
    tx as never,
    tokenIssuer as never,
    config as never,
    eventEmitter as never,
    logger as never,
    cls as never,
  );
  return {
    useCase,
    userRepo,
    historyRepo,
    sessionRepo,
    audit,
    tokenIssuer,
    eventEmitter,
    tokenService,
    breachedPwd,
  };
}

const validDto = {
  passwordChangeToken: 'token-1234567890',
  newPassword: 'BrandNewPass1',
  passwordConfirmation: 'BrandNewPass1',
};

describe('ChangeExpiredPasswordUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('changes the password, revokes sessions, audits and emits', async () => {
    const { useCase, sessionRepo, userRepo, audit, eventEmitter, tokenIssuer } =
      build({ mustChangePassword: true });

    const result = await useCase.execute(validDto);

    expect(userRepo.updatePasswordWithStatus).toHaveBeenCalledTimes(1);
    expect(sessionRepo.revokeAllForUser).toHaveBeenCalledWith('u1');
    expect(tokenIssuer.issue).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 900,
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.password_changed' }),
      { strict: true },
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'auth.password_changed',
      expect.anything(),
    );
    // Logs INFO at start AND end.
    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  it('throws when the password-change token is invalid', async () => {
    const { useCase, audit } = build({ userId: null });

    await expect(useCase.execute(validDto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rejects when password change is not required for the account', async () => {
    const { useCase, userRepo } = build({
      mustChangePassword: false,
      passwordExpiresAt: null,
    });

    await expect(useCase.execute(validDto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(userRepo.updatePasswordWithStatus).not.toHaveBeenCalled();
  });

  it('rejects a password that matches recent history', async () => {
    const { useCase, userRepo } = build({
      mustChangePassword: true,
      recentHashes: ['old-hash'],
      reuseMatches: true,
    });

    await expect(useCase.execute(validDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userRepo.updatePasswordWithStatus).not.toHaveBeenCalled();
  });

  it('rejects a breached password before persisting', async () => {
    const { useCase, userRepo } = build({
      mustChangePassword: true,
      breached: true,
    });

    await expect(useCase.execute(validDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userRepo.updatePasswordWithStatus).not.toHaveBeenCalled();
  });
});
