import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { GetUserByIdUseCase } from './get-user-by-id.use-case';

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
  lastName: 'Doe',
  password: 'hashed',
  emailVerifiedAt: new Date('2024-01-01'),
  passwordConfirmedAt: new Date('2024-01-02'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  deletedAt: null,
});

function build(found: User | null = EXISTING) {
  const userRepo = {
    findById: jest.fn().mockResolvedValue(found),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
    existsByEmail: jest.fn(),
    existsByUsername: jest.fn(),
  };

  const useCase = new GetUserByIdUseCase(
    userRepo,
    logger as never,
    cls as never,
  );

  return { useCase, userRepo };
}

describe('GetUserByIdUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a read model for an existing user', async () => {
    const { useCase } = build();

    const result = await useCase.execute('u-1');

    expect(result).toEqual({
      id: 'u-1',
      name: 'John',
      lastName: 'Doe',
      email: 'user@example.com',
      emailVerifiedAt: expect.any(Date),
      passwordConfirmedAt: expect.any(Date),
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });

  it('returns null when user is not found', async () => {
    const { useCase } = build(null);

    const result = await useCase.execute('u-1');

    expect(result).toBeNull();
  });
});
