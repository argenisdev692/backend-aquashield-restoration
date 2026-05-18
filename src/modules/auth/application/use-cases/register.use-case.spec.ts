import { ConflictException } from '@nestjs/common';
import { RegisterUseCase } from './register.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

function build(opts: { emailTaken?: boolean }) {
  const userRepo = {
    findByEmail: jest
      .fn()
      .mockResolvedValue(
        opts.emailTaken ? { id: 'existing', email: 'a@b.com' } : null,
      ),
    findById: jest.fn(),
    findByGoogleId: jest.fn(),
    findProfileById: jest.fn(),
    create: jest
      .fn()
      .mockResolvedValue({ id: 'u1', email: 'a@b.com', roleIds: [] }),
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
  };
  const historyRepo = {
    addEntry: jest.fn().mockResolvedValue(undefined),
    getRecent: jest.fn(),
    pruneOldest: jest.fn(),
  };
  const passwordHasher = {
    hash: jest.fn().mockResolvedValue('hashed'),
    compare: jest.fn(),
  };
  const emailPort = {
    sendVerificationLink: jest.fn().mockResolvedValue(undefined),
    sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    sendOtp: jest.fn(),
    sendPasswordResetCode: jest.fn(),
    sendSecurityAlert: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue('http://localhost:3000') };
  const eventEmitter = { emit: jest.fn() };

  const useCase = new RegisterUseCase(
    userRepo,
    historyRepo,
    passwordHasher,
    emailPort as never,
    audit,
    config as never,
    eventEmitter as never,
    logger as never,
    cls as never,
  );
  return { useCase, userRepo, historyRepo, emailPort, audit, eventEmitter };
}

const dto = {
  name: 'Jane',
  lastName: 'Doe',
  email: 'a@b.com',
  password: 'StrongPass1',
  passwordConfirmation: 'StrongPass1',
  termsAndConditions: true,
};

describe('RegisterUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates the user, seeds history, sends email, audits and emits', async () => {
    const { useCase, userRepo, historyRepo, emailPort, audit, eventEmitter } =
      build({});

    const result = await useCase.execute(dto);

    expect(userRepo.create).toHaveBeenCalledTimes(1);
    expect(historyRepo.addEntry).toHaveBeenCalledWith('u1', 'hashed');
    expect(emailPort.sendVerificationLink).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.registered' }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'auth.registered',
      expect.anything(),
    );
    expect(result).toEqual(
      expect.objectContaining({ id: 'u1', email: 'a@b.com' }),
    );
    // Logs INFO at start AND end.
    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  it('rejects a duplicate email without auditing', async () => {
    const { useCase, userRepo, audit } = build({ emailTaken: true });

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(userRepo.create).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
