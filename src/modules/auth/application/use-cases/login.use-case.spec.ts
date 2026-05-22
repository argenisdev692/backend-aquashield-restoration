import { UnauthorizedException } from '@nestjs/common';
import { LoginUseCase } from './login.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

const user = {
  id: 'u1',
  email: 'a@b.com',
  password: 'hashed',
  totpSecret: null,
  totpEnabled: false,
  roleIds: ['r1'],
  googleId: null,
  emailVerifiedAt: null,
  mustChangePassword: false,
  passwordExpiresAt: null,
};

function build(overrides: {
  compare?: boolean;
  found?: typeof user | null;
  cacheCount?: number;
}) {
  const userRepo = {
    findByEmail: jest
      .fn()
      .mockResolvedValue(
        overrides.found === undefined ? user : overrides.found,
      ),
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
    save: jest.fn().mockResolvedValue(undefined),
    findValid: jest.fn(),
    markUsed: jest.fn(),
    deleteExpired: jest.fn(),
  };
  const emailPort = {
    sendOtp: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetLink: jest.fn().mockResolvedValue(undefined),
    sendVerificationLink: jest.fn().mockResolvedValue(undefined),
    sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    sendSecurityAlert: jest.fn().mockResolvedValue(undefined),
    sendNewDeviceAlert: jest.fn().mockResolvedValue(undefined),
    sendPasswordChangedNotification: jest.fn().mockResolvedValue(undefined),
  };
  const passwordHasher = {
    compare: jest.fn().mockResolvedValue(overrides.compare ?? true),
    hash: jest.fn(),
  };
  const tokenService = {
    signAccessToken: jest.fn(),
    refreshTtlMs: jest.fn(),
    signPasswordChangeToken: jest.fn().mockResolvedValue('pc-token'),
    verifyPasswordChangeToken: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const cache = {
    get: jest.fn().mockResolvedValue(overrides.cacheCount ?? 0),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };
  const eventEmitter = { emit: jest.fn() };
  const trustedDeviceRepo = {
    save: jest.fn(),
    findValidForUser: jest.fn().mockResolvedValue(null),
    touch: jest.fn(),
    listForUser: jest.fn(),
    deleteByIdForUser: jest.fn(),
    deleteAllForUser: jest.fn(),
    deleteExpired: jest.fn(),
  };
  const tokenIssuer = {
    issue: jest.fn().mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 900,
    }),
  };

  const useCase = new LoginUseCase(
    userRepo,
    otpRepo,
    emailPort,
    passwordHasher,
    tokenService,
    audit,
    cache as never,
    trustedDeviceRepo,
    tokenIssuer as never,
    eventEmitter as never,
    logger as never,
    cls as never,
  );
  return { useCase, userRepo, otpRepo, emailPort, audit, cache, eventEmitter };
}

describe('LoginUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends an OTP and audits auth.otp_requested on valid credentials', async () => {
    const { useCase, otpRepo, emailPort, audit, cache } = build({
      compare: true,
    });

    const result = await useCase.execute({
      email: 'a@b.com',
      password: 'plain',
    });

    expect(result).toEqual({ requiresOtp: true, requiresTotp: false });
    expect(otpRepo.save).toHaveBeenCalledTimes(1);
    expect(emailPort.sendOtp).toHaveBeenCalledTimes(1);
    expect(cache.del).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.otp_requested' }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Login attempt',
      expect.any(Object),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'OTP sent for login',
      expect.any(Object),
    );
  });

  it('audits auth.login_failed and throws on wrong password', async () => {
    const { useCase, audit, cache } = build({ compare: false });

    await expect(
      useCase.execute({ email: 'a@b.com', password: 'bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login_failed' }),
    );
  });

  it('sends a security alert email on the 3rd failed attempt', async () => {
    const { useCase, emailPort, audit } = build({
      compare: false,
      cacheCount: 2,
    });

    await expect(
      useCase.execute({ email: 'a@b.com', password: 'bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // Fire-and-forget: flush the promise
    await Promise.resolve();

    expect(emailPort.sendSecurityAlert).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'login_attempts', attemptCount: 3 }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.security_alert_sent' }),
    );
  });

  it('throws when the user does not exist', async () => {
    const { useCase } = build({ found: null });
    await expect(
      useCase.execute({ email: 'x@y.com', password: 'p' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
