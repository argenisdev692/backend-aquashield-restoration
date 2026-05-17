jest.mock('@nestjs-cls/transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor,
}));

import { EmailAlreadyExistsException } from '../../domain/exceptions/user-domain.exception';
import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { CreateUserUseCase } from './create-user.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

const CREATED_USER = User.reconstitute({
  id: UserId.reconstitute('11111111-1111-1111-1111-111111111111'),
  email: Email.reconstitute('new@example.com'),
  name: 'John',
  lastName: 'Doe',
  password: null,
  emailVerifiedAt: null,
  passwordConfirmedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

function build(overrides: { existing?: User | null } = {}) {
  const userRepo = {
    findByEmail: jest.fn().mockResolvedValue(overrides.existing ?? null),
    findById: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn().mockResolvedValue(CREATED_USER),
    save: jest.fn(),
    softDelete: jest.fn(),
  };
  const setupRepo = {
    save: jest.fn().mockResolvedValue(undefined),
    findValid: jest.fn(),
    markUsed: jest.fn(),
    invalidateAllForUser: jest.fn(),
  };
  const emailPort = {
    sendPasswordSetupLink: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue('http://localhost:3000') };
  const eventEmitter = { emit: jest.fn() };
  const cache = {
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
  };

  const useCase = new CreateUserUseCase(
    userRepo,
    setupRepo,
    emailPort,
    audit,
    config as never,
    eventEmitter as never,
    logger as never,
    cls as never,
    cache as never,
  );

  return { useCase, userRepo, setupRepo, emailPort, audit, eventEmitter, cache };
}

describe('CreateUserUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates user, saves setup token, sends email, audits, and invalidates cache', async () => {
    const { useCase, userRepo, setupRepo, emailPort, audit, eventEmitter, cache } =
      build();

    const id = await useCase.execute(
      { name: 'John', lastName: 'Doe', email: 'new@example.com' },
      'actor-1',
    );

    expect(id).toBe('11111111-1111-1111-1111-111111111111');
    expect(userRepo.create).toHaveBeenCalledTimes(1);
    expect(setupRepo.save).toHaveBeenCalledTimes(1);
    expect(emailPort.sendPasswordSetupLink).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'new@example.com', type: 'setup' }),
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('users-service:users:list:*');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'users.created',
      expect.objectContaining({ userId: id }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.created',
        resourceType: 'USER',
        actorId: 'actor-1',
      }),
    );
  });

  it('throws EmailAlreadyExistsException when email is taken', async () => {
    const { useCase } = build({ existing: CREATED_USER });

    await expect(
      useCase.execute(
        { name: 'John', email: 'new@example.com' },
        'actor-1',
      ),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsException);
  });
});
