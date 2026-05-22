jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_t: unknown, _k: string, d: PropertyDescriptor) => d,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';

import { UpdateUserHandler } from '../../application/commands/handlers/update-user.handler';
import { UpdateUserCommand } from '../../application/commands/update-user.command';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../logger/logger.service';
import { CacheService } from '../../../../shared/cache/cache.service';
import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';
import {
  EmailAlreadyExistsException,
  UserNotFoundException,
} from '../../domain/exceptions/user-domain.exception';

const userId = '11111111-1111-1111-1111-111111111111';
const existing = User.reconstitute({
  id: UserId.reconstitute(userId),
  email: Email.create('a@example.com'),
  name: 'Alice',
  lastName: null,
  phone: null,
  password: 'hash',
  emailVerifiedAt: null,
  passwordConfirmedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

describe('UpdateUserHandler', () => {
  let handler: UpdateUserHandler;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCache: jest.Mocked<CacheService>;
  let mockCls: jest.Mocked<ClsService>;

  beforeEach(async () => {
    mockUserRepo = {
      findById: jest.fn().mockResolvedValue(existing),
      findByEmail: jest.fn().mockResolvedValue(null),
      findAll: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      existsByEmail: jest.fn(),
      existsByUsername: jest.fn(),
      bulkDelete: jest.fn(),
      bulkRestore: jest.fn(),
      findAccessByUserId: jest.fn().mockResolvedValue({ roles: [], permissions: [] }),
      findAccessByUserIds: jest.fn().mockResolvedValue(new Map()),
      replaceRoles: jest.fn().mockResolvedValue(undefined),
      replacePermissions: jest.fn().mockResolvedValue(undefined),
    };
    mockAudit = { log: jest.fn() };
    mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), setContext: jest.fn() } as unknown as jest.Mocked<LoggerService>;
    mockCache = { del: jest.fn(), delByPattern: jest.fn(), get: jest.fn(), set: jest.fn() } as unknown as jest.Mocked<CacheService>;
    mockCls = { get: jest.fn().mockReturnValue('trace-1') } as unknown as jest.Mocked<ClsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateUserHandler,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ClsService, useValue: mockCls },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    handler = module.get(UpdateUserHandler);
  });

  it('updates user, audits and invalidates cache', async () => {
    await handler.execute(
      new UpdateUserCommand(userId, { name: 'Alicia' }, 'actor-1'),
    );

    expect(mockUserRepo.save).toHaveBeenCalledTimes(1);
    expect(mockCache.del).toHaveBeenCalledWith(`users-service:user:${userId}`);
    expect(mockCache.delByPattern).toHaveBeenCalledWith(
      'users-service:users:list:*',
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.updated',
        resourceType: 'USER',
        resourceId: userId,
        actorId: 'actor-1',
      }),
      { strict: true },
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'UpdateUserHandler start',
      expect.any(Object),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'UpdateUserHandler end',
      expect.any(Object),
    );
  });

  it('throws UserNotFoundException when user does not exist', async () => {
    mockUserRepo.findById.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new UpdateUserCommand(userId, { name: 'X' }, 'a')),
    ).rejects.toBeInstanceOf(UserNotFoundException);

    expect(mockUserRepo.save).not.toHaveBeenCalled();
    expect(mockAudit.log).not.toHaveBeenCalled();
    expect(mockCache.del).not.toHaveBeenCalled();
  });

  it('replaces roles when roleIds is sent (even empty)', async () => {
    await handler.execute(
      new UpdateUserCommand(userId, { roleIds: [] }, 'actor-1'),
    );
    expect(mockUserRepo.replaceRoles).toHaveBeenCalledWith(userId, [], 'actor-1');
    // CASL ability snapshot must be invalidated so the next request reflects the change.
    expect(mockCache.del).toHaveBeenCalledWith(`casl:ability:${userId}`);
    // Audit metadata carries the touched arrays.
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.updated',
        metadata: { roleIds: [], permissionIds: null },
      }),
      { strict: true },
    );
  });

  it('replaces permissions independently of roles', async () => {
    const permIds = [
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444',
    ];
    await handler.execute(
      new UpdateUserCommand(userId, { permissionIds: permIds }, 'actor-1'),
    );
    expect(mockUserRepo.replacePermissions).toHaveBeenCalledWith(
      userId,
      permIds,
      'actor-1',
    );
    expect(mockUserRepo.replaceRoles).not.toHaveBeenCalled();
    expect(mockCache.del).toHaveBeenCalledWith(`casl:ability:${userId}`);
  });

  it('skips CASL cache invalidation when ACL fields are not in the body', async () => {
    await handler.execute(
      new UpdateUserCommand(userId, { name: 'Alicia' }, 'actor-1'),
    );
    expect(mockUserRepo.replaceRoles).not.toHaveBeenCalled();
    expect(mockUserRepo.replacePermissions).not.toHaveBeenCalled();
    expect(mockCache.del).not.toHaveBeenCalledWith(`casl:ability:${userId}`);
  });

  it('throws EmailAlreadyExistsException when target email belongs to another user', async () => {
    const other = User.reconstitute({
      id: UserId.reconstitute('22222222-2222-2222-2222-222222222222'),
      email: Email.create('taken@example.com'),
      name: 'B',
      lastName: null,
      phone: null,
      password: null,
      emailVerifiedAt: null,
      passwordConfirmedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    mockUserRepo.findByEmail.mockResolvedValueOnce(other);

    await expect(
      handler.execute(
        new UpdateUserCommand(userId, { email: 'taken@example.com' }, 'a'),
      ),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsException);

    expect(mockUserRepo.save).not.toHaveBeenCalled();
  });
});
