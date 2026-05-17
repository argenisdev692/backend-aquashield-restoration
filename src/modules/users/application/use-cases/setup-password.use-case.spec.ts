import { UnauthorizedException } from '@nestjs/common';
import { SetupPasswordUseCase } from './setup-password.use-case';

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
  setPassword: jest.fn(),
};

function build(overrides: { tokenRow?: unknown; user?: unknown } = {}) {
  const userRepo = {
    findById: jest.fn().mockResolvedValue(overrides.user === undefined ? mockUser : overrides.user),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    softDelete: jest.fn(),
  };
  const setupRepo = {
    save: jest.fn(),
    findValid: jest.fn().mockResolvedValue(
      overrides.tokenRow === undefined
        ? { id: 't-1', userId: 'u-1', type: 'setup', expiresAt: new Date() }
        : overrides.tokenRow,
    ),
    markUsed: jest.fn().mockResolvedValue(undefined),
    invalidateAllForUser: jest.fn(),
  };
  const passwordHasher = {
    hash: jest.fn().mockResolvedValue('new-hash'),
    compare: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const eventEmitter = { emit: jest.fn() };
  const cache = {
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
  };

  const useCase = new SetupPasswordUseCase(
    userRepo,
    setupRepo,
    passwordHasher,
    audit,
    eventEmitter as never,
    logger as never,
    cls as never,
    cache as never,
  );

  return { useCase, userRepo, setupRepo, audit, eventEmitter, cache };
}

describe('SetupPasswordUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sets password, marks token used, emits event, invalidates cache, and audits', async () => {
    const { useCase, userRepo, setupRepo, audit, eventEmitter, cache } = build();

    await useCase.execute({ token: 'raw-token', password: 'Passw0rd!', passwordConfirmation: 'Passw0rd!' });

    expect(userRepo.save).toHaveBeenCalledTimes(1);
    expect(setupRepo.markUsed).toHaveBeenCalledWith('t-1');
    expect(cache.del).toHaveBeenCalledWith('users-service:user:u-1');
    expect(cache.delByPattern).toHaveBeenCalledWith('users-service:users:list:*');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'users.password_setup',
      expect.objectContaining({ userId: 'u-1' }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'users.password_setup' }),
    );
  });

  it('throws UnauthorizedException when token is invalid', async () => {
    const { useCase } = build({ tokenRow: null });

    await expect(
      useCase.execute({ token: 'bad', password: 'Passw0rd!', passwordConfirmation: 'Passw0rd!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws UnauthorizedException when user not found', async () => {
    const { useCase } = build({ user: null });

    await expect(
      useCase.execute({ token: 'tok', password: 'Passw0rd!', passwordConfirmation: 'Passw0rd!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
