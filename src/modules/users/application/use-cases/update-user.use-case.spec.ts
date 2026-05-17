import {
  UserNotFoundException,
  EmailAlreadyExistsException,
} from '../../domain/exceptions/user-domain.exception';
import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { UpdateUserUseCase } from './update-user.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

const EXISTING = User.reconstitute({
  id: UserId.reconstitute('u-1'),
  email: Email.reconstitute('old@example.com'),
  name: 'Old',
  lastName: null,
  password: 'hashed',
  emailVerifiedAt: null,
  passwordConfirmedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

function build(overrides: { found?: User | null; emailTaken?: User | null } = {}) {
  const userRepo = {
    findById: jest.fn().mockResolvedValue(overrides.found === undefined ? EXISTING : overrides.found),
    findByEmail: jest.fn().mockResolvedValue(overrides.emailTaken ?? null),
    findAll: jest.fn(),
    create: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    softDelete: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const cache = {
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
  };

  const useCase = new UpdateUserUseCase(
    userRepo,
    audit,
    logger as never,
    cls as never,
    cache as never,
  );

  return { useCase, userRepo, audit, cache };
}

describe('UpdateUserUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates user, invalidates cache, and audits', async () => {
    const { useCase, userRepo, audit, cache } = build();

    await useCase.execute('u-1', { name: 'New' }, 'actor-1');

    expect(userRepo.save).toHaveBeenCalledTimes(1);
    expect(cache.del).toHaveBeenCalledWith('users-service:user:u-1');
    expect(cache.delByPattern).toHaveBeenCalledWith('users-service:users:list:*');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'users.updated', actorId: 'actor-1' }),
    );
  });

  it('throws UserNotFoundException when user does not exist', async () => {
    const { useCase } = build({ found: null });

    await expect(
      useCase.execute('u-1', { name: 'New' }, 'actor-1'),
    ).rejects.toBeInstanceOf(UserNotFoundException);
  });

  it('throws EmailAlreadyExistsException when new email is taken by another user', async () => {
    const other = User.reconstitute({
      id: UserId.reconstitute('u-2'),
      email: Email.reconstitute('taken@example.com'),
      name: 'Other',
      lastName: null,
      password: null,
      emailVerifiedAt: null,
      passwordConfirmedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    const { useCase } = build({ emailTaken: other });

    await expect(
      useCase.execute('u-1', { email: 'taken@example.com' }, 'actor-1'),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsException);
  });
});
