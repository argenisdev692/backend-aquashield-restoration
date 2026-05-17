import { RequestPasswordChangeUseCase } from './request-password-change.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

const mockUser = {
  id: { value: 'u-1' },
  name: 'John',
  email: { value: 'john@example.com' },
};

function build(found: unknown = mockUser) {
  const userRepo = {
    findById: jest.fn(),
    findByEmail: jest.fn().mockResolvedValue(found),
    findAll: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };
  const setupRepo = {
    save: jest.fn().mockResolvedValue(undefined),
    findValid: jest.fn(),
    markUsed: jest.fn(),
    invalidateAllForUser: jest.fn().mockResolvedValue(undefined),
  };
  const emailPort = {
    sendPasswordSetupLink: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue('http://localhost:3000') };

  const useCase = new RequestPasswordChangeUseCase(
    userRepo,
    setupRepo,
    emailPort,
    audit,
    config as never,
    logger as never,
    cls as never,
  );

  return { useCase, userRepo, setupRepo, emailPort, audit };
}

describe('RequestPasswordChangeUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates old tokens, saves new token, sends email, and audits', async () => {
    const { useCase, setupRepo, emailPort, audit } = build();

    await useCase.execute({ email: 'john@example.com' });

    expect(setupRepo.invalidateAllForUser).toHaveBeenCalledWith('u-1', 'change');
    expect(setupRepo.save).toHaveBeenCalledTimes(1);
    expect(emailPort.sendPasswordSetupLink).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'john@example.com', type: 'change' }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'users.password_change_requested' }),
    );
  });

  it('returns void (no message object)', async () => {
    const { useCase } = build();

    const result = await useCase.execute({ email: 'john@example.com' });

    expect(result).toBeUndefined();
  });

  it('silently succeeds when user not found (timing-safe)', async () => {
    const { useCase, setupRepo, emailPort, audit } = build(null);

    await expect(
      useCase.execute({ email: 'unknown@example.com' }),
    ).resolves.toBeUndefined();

    expect(setupRepo.save).not.toHaveBeenCalled();
    expect(emailPort.sendPasswordSetupLink).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
