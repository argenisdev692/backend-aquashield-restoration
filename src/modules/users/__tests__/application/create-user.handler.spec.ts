jest.mock('@nestjs-cls/transactional', () => ({
  Transactional: () => (_t: unknown, _k: string, d: PropertyDescriptor) => d,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';

import { CreateUserHandler } from '../../application/commands/handlers/create-user.handler';
import { CreateUserCommand } from '../../application/commands/create-user.command';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { PASSWORD_SETUP_REPOSITORY } from '../../domain/repositories/password-setup.repository.interface';
import type { IPasswordSetupRepository } from '../../domain/repositories/password-setup.repository.interface';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../logger/logger.service';
import { CacheService } from '../../../../shared/cache/cache.service';
import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { EmailAlreadyExistsException } from '../../domain/exceptions/user-domain.exception';

describe('CreateUserHandler', () => {
  let handler: CreateUserHandler;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockSetupRepo: jest.Mocked<IPasswordSetupRepository>;
  let mockEmailPort: jest.Mocked<IEmailPort>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCache: jest.Mocked<CacheService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockConfig: jest.Mocked<ConfigService>;
  let mockCls: jest.Mocked<ClsService>;

  const created = User.reconstitute({
    id: UserId.reconstitute('11111111-1111-1111-1111-111111111111'),
    email: Email.create('user@example.com'),
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

  beforeEach(async () => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
      findAll: jest.fn(),
      create: jest.fn().mockResolvedValue(created),
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
    mockSetupRepo = {
      save: jest.fn(),
      findValid: jest.fn(),
      markUsed: jest.fn(),
      invalidateAllForUser: jest.fn(),
    };
    mockEmailPort = { sendPasswordSetupLink: jest.fn() };
    mockAudit = { log: jest.fn() };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setContext: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;
    mockCache = {
      del: jest.fn(),
      delByPattern: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;
    mockEventEmitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;
    mockConfig = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    } as unknown as jest.Mocked<ConfigService>;
    mockCls = {
      get: jest.fn().mockReturnValue('trace-123'),
    } as unknown as jest.Mocked<ClsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateUserHandler,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: PASSWORD_SETUP_REPOSITORY, useValue: mockSetupRepo },
        { provide: EMAIL_PORT, useValue: mockEmailPort },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ClsService, useValue: mockCls },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    handler = module.get(CreateUserHandler);
  });

  it('creates user, audits, emits event, sends email and invalidates cache', async () => {
    const command = new CreateUserCommand(
      { name: 'Alice', email: 'user@example.com' },
      'actor-1',
    );

    const id = await handler.execute(command);

    expect(id).toBe(created.id.value);
    expect(mockUserRepo.create).toHaveBeenCalledTimes(1);
    expect(mockSetupRepo.save).toHaveBeenCalledTimes(1);
    expect(mockEmailPort.sendPasswordSetupLink).toHaveBeenCalledTimes(1);
    expect(mockCache.delByPattern).toHaveBeenCalledWith(
      'users-service:users:list:*',
    );
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'users.created',
      expect.objectContaining({ userId: created.id.value }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.created',
        resourceType: 'USER',
        resourceId: created.id.value,
        actorId: 'actor-1',
      }),
      { strict: true },
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'CreateUserHandler start',
      expect.any(Object),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'CreateUserHandler end',
      expect.any(Object),
    );
  });

  it('replaces roles + permissions inside the tx when the DTO carries them', async () => {
    const roleIds = ['22222222-2222-2222-2222-222222222222'];
    const permissionIds = [
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444',
    ];
    await handler.execute(
      new CreateUserCommand(
        { name: 'A', email: 'a@example.com', roleIds, permissionIds },
        'actor-1',
      ),
    );

    expect(mockUserRepo.replaceRoles).toHaveBeenCalledWith(
      created.id.value,
      roleIds,
      'actor-1',
    );
    expect(mockUserRepo.replacePermissions).toHaveBeenCalledWith(
      created.id.value,
      permissionIds,
      'actor-1',
    );
    // CASL ability cache must be dropped so the next request sees the grants.
    expect(mockCache.del).toHaveBeenCalledWith(
      `casl:ability:${created.id.value}`,
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { roleIds, permissionIds },
      }),
      { strict: true },
    );
  });

  it('skips CASL invalidation when neither roleIds nor permissionIds is sent', async () => {
    await handler.execute(
      new CreateUserCommand({ name: 'A', email: 'a@example.com' }, 'actor-1'),
    );
    expect(mockUserRepo.replaceRoles).not.toHaveBeenCalled();
    expect(mockUserRepo.replacePermissions).not.toHaveBeenCalled();
    expect(mockCache.del).not.toHaveBeenCalledWith(
      `casl:ability:${created.id.value}`,
    );
  });

  it('throws EmailAlreadyExistsException when email is taken', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(created);

    await expect(
      handler.execute(
        new CreateUserCommand(
          { name: 'A', email: 'user@example.com' },
          'actor-1',
        ),
      ),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsException);

    expect(mockUserRepo.create).not.toHaveBeenCalled();
    expect(mockEmailPort.sendPasswordSetupLink).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    expect(mockCache.delByPattern).not.toHaveBeenCalled();
    expect(mockAudit.log).not.toHaveBeenCalled();
  });
});
