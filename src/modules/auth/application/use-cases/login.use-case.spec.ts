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
};

function build(overrides: { compare?: boolean; found?: typeof user | null }) {
  const userRepo = {
    findByEmail: jest
      .fn()
      .mockResolvedValue(
        overrides.found === undefined ? user : overrides.found,
      ),
    findById: jest.fn(),
    updateTotpSecret: jest.fn(),
    enableTotp: jest.fn(),
    disableTotp: jest.fn(),
  };
  const otpRepo = {
    save: jest.fn().mockResolvedValue(undefined),
    findValid: jest.fn(),
    markUsed: jest.fn(),
    deleteExpired: jest.fn(),
  };
  const emailPort = { sendOtp: jest.fn().mockResolvedValue(undefined) };
  const passwordHasher = {
    compare: jest.fn().mockResolvedValue(overrides.compare ?? true),
    hash: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const eventEmitter = { emit: jest.fn() };

  const useCase = new LoginUseCase(
    userRepo,
    otpRepo,
    emailPort,
    passwordHasher,
    audit,
    eventEmitter as never,
    logger as never,
    cls as never,
  );
  return { useCase, userRepo, otpRepo, emailPort, audit, eventEmitter };
}

describe('LoginUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends an OTP and audits auth.otp_requested on valid credentials', async () => {
    const { useCase, otpRepo, emailPort, audit } = build({ compare: true });

    const result = await useCase.execute({
      email: 'a@b.com',
      password: 'plain',
    });

    expect(result).toEqual({ requiresOtp: true, requiresTotp: false });
    expect(otpRepo.save).toHaveBeenCalledTimes(1);
    expect(emailPort.sendOtp).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.otp_requested' }),
    );
    // Audit rule: write UseCases log INFO at START *and* END.
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
    const { useCase, audit } = build({ compare: false });

    await expect(
      useCase.execute({ email: 'a@b.com', password: 'bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login_failed' }),
    );
  });

  it('throws when the user does not exist', async () => {
    const { useCase } = build({ found: null });
    await expect(
      useCase.execute({ email: 'x@y.com', password: 'p' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
