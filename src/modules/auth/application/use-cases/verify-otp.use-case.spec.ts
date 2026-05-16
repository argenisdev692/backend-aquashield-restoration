import { UnauthorizedException } from '@nestjs/common';
import { VerifyOtpUseCase } from './verify-otp.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

const baseUser = {
  id: 'u1',
  email: 'a@b.com',
  password: 'h',
  totpSecret: null as string | null,
  totpEnabled: false,
  roleIds: ['r1'],
  googleId: null as string | null,
  emailVerifiedAt: null as Date | null,
};

function build(opts: {
  user?: typeof baseUser | null;
  stored?: { id: string; code: string; expiresAt: Date } | null;
}) {
  const userRepo = {
    findByEmail: jest
      .fn()
      .mockResolvedValue(opts.user === undefined ? baseUser : opts.user),
    findById: jest.fn(),
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
  const otpRepo = {
    save: jest.fn(),
    findValid: jest
      .fn()
      .mockResolvedValue(
        opts.stored === undefined
          ? { id: 'o1', code: '1234', expiresAt: new Date() }
          : opts.stored,
      ),
    markUsed: jest.fn().mockResolvedValue(undefined),
    deleteExpired: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const tokenIssuer = {
    issue: jest.fn().mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 900,
    }),
  };
  const eventEmitter = { emit: jest.fn() };
  // ITransactionManager mock: pass-through.
  const tx = {
    runInTx: jest.fn((fn: () => Promise<unknown>) => fn()),
  };

  const useCase = new VerifyOtpUseCase(
    userRepo,
    otpRepo,
    audit,
    tx as never,
    tokenIssuer as never,
    eventEmitter as never,
    logger as never,
    cls as never,
  );
  return { useCase, otpRepo, audit, tokenIssuer, eventEmitter, tx };
}

describe('VerifyOtpUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('issues tokens and audits auth.login when TOTP is not enabled', async () => {
    const { useCase, audit, tokenIssuer } = build({});

    const result = await useCase.execute({
      email: 'a@b.com',
      code: '1234',
      type: 'login',
    });

    expect(result).toEqual({
      requiresTotp: false,
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 900,
    });
    expect(tokenIssuer.issue).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.otp_verified' }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login' }),
    );
  });

  it('returns requiresTotp without issuing tokens when 2FA is enabled', async () => {
    const { useCase, tokenIssuer } = build({
      user: { ...baseUser, totpEnabled: true, totpSecret: 's' },
    });

    const result = await useCase.execute({
      email: 'a@b.com',
      code: '1234',
      type: 'login',
    });

    expect(result).toEqual({ requiresTotp: true });
    expect(tokenIssuer.issue).not.toHaveBeenCalled();
  });

  it('audits auth.otp_failed and throws on a wrong code', async () => {
    const { useCase, audit } = build({
      stored: { id: 'o1', code: '9999', expiresAt: new Date() },
    });

    await expect(
      useCase.execute({ email: 'a@b.com', code: '1234', type: 'login' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.otp_failed' }),
    );
  });
});
