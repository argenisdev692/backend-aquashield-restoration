import { UserNotFoundException } from '../../domain/exceptions/user-domain.exception';
import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { DeleteUserUseCase } from './delete-user.use-case';

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
  email: Email.reconstitute('user@example.com'),
  name: 'John',
  lastName: null,
  password: 'hashed',
  emailVerifiedAt: null,
  passwordConfirmedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

function build(found: User | null = EXISTING) {
  const userRepo = {
    findById: jest.fn().mockResolvedValue(found),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn().mockResolvedValue(undefined),
    existsByEmail: jest.fn(),
    existsByUsername: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const cache = {
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
  };

  const useCase = new DeleteUserUseCase(
    userRepo,
    audit,
    logger as never,
    cls as never,
    cache as never,
  );

  return { useCase, userRepo, audit, cache };
}

describe('DeleteUserUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('soft-deletes user, invalidates cache, and audits', async () => {
    const { useCase, userRepo, audit, cache } = build();

    await useCase.execute('u-1', 'actor-1');

    expect(userRepo.softDelete).toHaveBeenCalledWith('u-1');
    expect(cache.del).toHaveBeenCalledWith('users-service:user:u-1');
    expect(cache.delByPattern).toHaveBeenCalledWith('users-service:users:list:*');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'users.deleted', actorId: 'actor-1' }),
    );
  });

  it('throws UserNotFoundException when user does not exist', async () => {
    const { useCase } = build(null);

    await expect(useCase.execute('u-1', 'actor-1')).rejects.toBeInstanceOf(
      UserNotFoundException,
    );
  });
});
