import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { GetUsersListUseCase } from './get-users-list.use-case';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};
const cls = { get: jest.fn().mockReturnValue('trace-1') };

const USERS = [
  User.reconstitute({
    id: UserId.reconstitute('u-1'),
    email: Email.reconstitute('a@b.com'),
    name: 'Alice',
    lastName: null,
    password: null,
    emailVerifiedAt: null,
    passwordConfirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  }),
];

function build() {
  const userRepo = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn().mockResolvedValue({ users: USERS, total: 1 }),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const useCase = new GetUsersListUseCase(
    userRepo,
    logger as never,
    cls as never,
  );

  return { useCase, userRepo };
}

describe('GetUsersListUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns paginated user list', async () => {
    const { useCase, userRepo } = build();

    const result = await useCase.execute({ page: 1, limit: 20 });

    expect(userRepo.findAll).toHaveBeenCalledWith({
      skip: 0,
      take: 20,
      search: undefined,
    });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.data[0]?.id).toBe('u-1');
  });

  it('passes search param correctly', async () => {
    const { useCase, userRepo } = build();

    await useCase.execute({ page: 2, limit: 10, search: 'alice' });

    expect(userRepo.findAll).toHaveBeenCalledWith({
      skip: 10,
      take: 10,
      search: 'alice',
    });
  });
});
