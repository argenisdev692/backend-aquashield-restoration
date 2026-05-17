import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { ExportUsersUseCase } from './export-users.use-case';

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
    lastName: 'Smith',
    password: null,
    emailVerifiedAt: null,
    passwordConfirmedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
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
  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  const useCase = new ExportUsersUseCase(
    userRepo,
    audit,
    logger as never,
    cls as never,
  );

  return { useCase, userRepo, audit };
}

describe('ExportUsersUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a Buffer (pdf) and audits', async () => {
    const { useCase, audit } = build();

    const buffer = await useCase.execute(
      { page: 1, limit: 20 },
      'pdf',
      'actor-1',
    );

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.export',
        metadata: { format: 'pdf', rowCount: 1 },
      }),
    );
  });

  it('returns a Buffer (xlsx) and audits', async () => {
    const { useCase, audit, userRepo } = build();

    const buffer = await useCase.execute(
      { page: 1, limit: 20 },
      'xlsx',
      'actor-1',
    );

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(userRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10_000 }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.export',
        actorId: 'actor-1',
        metadata: { format: 'xlsx', rowCount: 1 },
      }),
    );
  });
});
