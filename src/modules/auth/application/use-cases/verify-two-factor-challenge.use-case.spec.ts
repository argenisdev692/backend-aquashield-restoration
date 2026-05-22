import { UnauthorizedException } from '@nestjs/common';
import { VerifyTwoFactorChallengeUseCase } from './verify-two-factor-challenge.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};

const baseUser = {
  id: 'u1',
  email: 'a@b.com',
  password: 'h',
  totpSecret: 'SECRET',
  totpEnabled: true,
  roleIds: ['role-1'],
  roleNames: ['admin'],
  googleId: null,
  emailVerifiedAt: null,
  mustChangePassword: false,
  passwordExpiresAt: null,
  lockedUntil: null,
};

function build(opts: {
  unusedCodes?: Array<{ id: string; codeHash: string; usedAt: null }>;
  hashMatchIndex?: number | null;
  remainingAfter?: number;
}) {
  const userRepo = {
    findByEmail: jest.fn().mockResolvedValue({ ...baseUser }),
    findById: jest.fn(),
    findByGoogleId: jest.fn(),
    findProfileById: jest.fn(),
    create: jest.fn(),
    updateTotpSecret: jest.fn(),
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
    setLockedUntil: jest.fn(),
    clearLockedUntil: jest.fn(),
  };
  const otpRepo = {
    save: jest.fn(),
    findValid: jest.fn(),
    markUsed: jest.fn().mockResolvedValue(undefined),
    deleteExpired: jest.fn(),
  };
  const totp = {
    generateSecret: jest.fn(),
    generateUri: jest.fn(),
    verify: jest.fn(),
  };
  const unusedCodes = opts.unusedCodes ?? [
    { id: 'bc-1', codeHash: 'hash1', usedAt: null },
    { id: 'bc-2', codeHash: 'hash2', usedAt: null },
    { id: 'bc-3', codeHash: 'hash3', usedAt: null },
  ];
  const backupCodeRepo = {
    replaceAllForUser: jest.fn(),
    findUnusedByUserId: jest.fn().mockResolvedValue(unusedCodes),
    markUsed: jest.fn().mockResolvedValue(undefined),
    deleteAllForUser: jest.fn(),
    countUnusedByUserId: jest
      .fn()
      .mockResolvedValue(opts.remainingAfter ?? unusedCodes.length - 1),
  };
  const passwordHasher = {
    hash: jest.fn(),
    compare: jest.fn(async (_plain: string, hashed: string) => {
      if (opts.hashMatchIndex === null || opts.hashMatchIndex === undefined) {
        return false;
      }
      return hashed === unusedCodes[opts.hashMatchIndex].codeHash;
    }),
  };
  const trustedDeviceRepo = {
    save: jest.fn(),
    findValidForUser: jest.fn(),
    touch: jest.fn(),
    listForUser: jest.fn(),
    deleteByIdForUser: jest.fn(),
    deleteAllForUser: jest.fn(),
    deleteExpired: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const tx = { runInTx: async (fn: () => Promise<unknown>) => fn() };
  const tokenIssuer = {
    issue: jest.fn().mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 900,
      isNewDevice: false,
    }),
  };
  const eventEmitter = { emit: jest.fn() };
  const cls = {
    get: jest.fn((key?: string) => {
      if (key === 'userAgent') return 'jest-ua';
      if (key === 'ipAddress') return '127.0.0.1';
      return 'trace-1';
    }),
  };

  const useCase = new VerifyTwoFactorChallengeUseCase(
    userRepo,
    otpRepo,
    totp as never,
    backupCodeRepo,
    passwordHasher,
    trustedDeviceRepo as never,
    audit,
    tx as never,
    tokenIssuer as never,
    eventEmitter as never,
    logger as never,
    cls as never,
  );
  return {
    useCase,
    audit,
    backupCodeRepo,
    passwordHasher,
    tokenIssuer,
    eventEmitter,
  };
}

describe('VerifyTwoFactorChallengeUseCase — backup_code branch', () => {
  beforeEach(() => jest.clearAllMocks());

  it('issues tokens, marks the matched code used and audits with strict:true', async () => {
    const { useCase, audit, backupCodeRepo, tokenIssuer } = build({
      hashMatchIndex: 1,
      remainingAfter: 2,
    });

    const result = await useCase.execute({
      email: 'a@b.com',
      code: 'ABCD-EFGH',
      type: 'backup_code',
    });

    expect(backupCodeRepo.markUsed).toHaveBeenCalledWith('bc-2');
    expect(tokenIssuer.issue).toHaveBeenCalledTimes(1);
    expect(result.accessToken).toBe('access');
    expect(result.usedBackupCode).toBe(true);
    expect(result.backupCodesRemaining).toBe(2);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.login',
        metadata: expect.objectContaining({
          method: 'backup_code',
          backupCodesRemaining: 2,
        }),
      }),
      { strict: true },
    );
  });

  it('iterates ALL unused codes (time-constant) even when an early code matches', async () => {
    const { useCase, passwordHasher } = build({ hashMatchIndex: 0 });

    await useCase.execute({
      email: 'a@b.com',
      code: 'ABCD-EFGH',
      type: 'backup_code',
    });

    expect(passwordHasher.compare).toHaveBeenCalledTimes(3);
  });

  it('throws UnauthorizedException + audits auth.backup_code_failed when no code matches', async () => {
    const { useCase, audit, backupCodeRepo } = build({ hashMatchIndex: null });

    await expect(
      useCase.execute({
        email: 'a@b.com',
        code: 'ZZZZ-ZZZZ',
        type: 'backup_code',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(backupCodeRepo.markUsed).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.backup_code_failed' }),
    );
  });
});
