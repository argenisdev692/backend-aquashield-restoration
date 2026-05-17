import { UnauthorizedException } from '@nestjs/common';
import { ChangePasswordUseCase } from './change-password.use-case';

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
  changePassword: jest.fn(),
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
        ? { id: 't-1', userId: 'u-1', type: 'change', expiresAt: new Date() }
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

  const useCase = new ChangePasswordUseCase(
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

describe('ChangePasswordUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('changes password, marks token used, emits event, invalidates cache, and audits', async () => {
    const { useCase, userRepo, setupRepo, audit, eventEmitter, cache } = build();

    await useCase.execute({ token: 'raw', password: 'NewPass1!', passwordConfirmation: 'NewPass1!' });

    expect(userRepo.save).toHaveBeenCalledTimes(1);
    expect(setupRepo.markUsed).toHaveBeenCalledWith('t-1');
    expect(cache.del).toHaveBeenCalledWith('users-service:user:u-1');
    expect(cache.delByPattern).toHaveBeenCalledWith('users-service:users:list:*');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'users.password_changed',
      expect.objectContaining({ userId: 'u-1' }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'users.password_changed' }),
    );
  });

  it('throws UnauthorizedException when token is invalid', async () => {
    const { useCase } = build({ tokenRow: null });

    await expect(
      useCase.execute({ token: 'bad', password: 'p', passwordConfirmation: 'p' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws when token type is not "change"', async () => {
    const { useCase } = build({
      tokenRow: { id: 't-1', userId: 'u-1', type: 'setup', expiresAt: new Date() },
    });

    await expect(
      useCase.execute({ token: 'tok', password: 'p', passwordConfirmation: 'p' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
