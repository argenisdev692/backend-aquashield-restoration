jest.mock('@nestjs-cls/transactional', () => ({
  Transactional: () => (_t: unknown, _k: string, d: PropertyDescriptor) => d,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';

import { DeleteUserHandler } from '../../application/commands/handlers/delete-user.handler';
import { DeleteUserCommand } from '../../application/commands/delete-user.command';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../logger/logger.service';
import { CacheService } from '../../../../shared/cache/cache.service';
import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { UserNotFoundException } from '../../domain/exceptions/user-domain.exception';

const userId = '11111111-1111-1111-1111-111111111111';
const existing = User.reconstitute({
  id: UserId.reconstitute(userId),
  email: Email.create('a@example.com'),
  name: 'Alice',
  lastName: null,
  phone: null,
  username: null,
  dateOfBirth: null,
  address: null,
  address2: null,
  zipCode: null,
  city: null,
  state: null,
  country: null,
  gender: null,
  profilePhotoPath: null,
  totpEnabled: false,
  mustChangePassword: false,
  password: null,
  emailVerifiedAt: null,
  passwordConfirmedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

describe('DeleteUserHandler', () => {
  let handler: DeleteUserHandler;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCache: jest.Mocked<CacheService>;
  let mockCls: jest.Mocked<ClsService>;

  beforeEach(async () => {
    mockUserRepo = {
      findById: jest.fn().mockResolvedValue(existing),
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      existsByEmail: jest.fn(),
      existsByUsername: jest.fn(),
      bulkDelete: jest.fn(),
      bulkRestore: jest.fn(),
      findAccessByUserId: jest
        .fn()
        .mockResolvedValue({ roles: [], permissions: [] }),
      findAccessByUserIds: jest.fn().mockResolvedValue(new Map()),
      replaceRoles: jest.fn().mockResolvedValue(undefined),
      replacePermissions: jest.fn().mockResolvedValue(undefined),
    };
    mockAudit = { log: jest.fn() };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setContext: jest.fn(),
    };
    mockCache = {
      del: jest.fn(),
      delByPattern: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };
    mockCls = {
      get: jest.fn().mockReturnValue('trace-1'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteUserHandler,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ClsService, useValue: mockCls },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    handler = module.get(DeleteUserHandler);
  });

  it('soft-deletes, audits and invalidates cache', async () => {
    await handler.execute(new DeleteUserCommand(userId, 'actor-1'));

    expect(mockUserRepo.softDelete).toHaveBeenCalledWith(userId);
    expect(mockCache.del).toHaveBeenCalledWith(`users-service:user:${userId}`);
    expect(mockCache.delByPattern).toHaveBeenCalledWith(
      'users-service:users:list:*',
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.deleted',
        resourceType: 'USER',
        resourceId: userId,
        actorId: 'actor-1',
      }),
      { strict: true },
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'DeleteUserHandler start',
      expect.any(Object),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'DeleteUserHandler end',
      expect.any(Object),
    );
  });

  it('throws UserNotFoundException when user is missing', async () => {
    mockUserRepo.findById.mockResolvedValueOnce(null);
    await expect(
      handler.execute(new DeleteUserCommand(userId, 'a')),
    ).rejects.toBeInstanceOf(UserNotFoundException);
    expect(mockUserRepo.softDelete).not.toHaveBeenCalled();
    expect(mockAudit.log).not.toHaveBeenCalled();
  });
});
