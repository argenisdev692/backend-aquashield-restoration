jest.mock('@nestjs-cls/transactional', () => ({
  Transactional: () => (_t: unknown, _k: string, d: PropertyDescriptor) => d,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';

import { SetupPasswordHandler } from '../../application/commands/handlers/setup-password.handler';
import { SetupPasswordCommand } from '../../application/commands/setup-password.command';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { PASSWORD_SETUP_REPOSITORY } from '../../domain/repositories/password-setup.repository.interface';
import type { IPasswordSetupRepository } from '../../domain/repositories/password-setup.repository.interface';
import { PASSWORD_HASHER_PORT } from '../../domain/ports/outbound/password-hasher.port';
import type { IPasswordHasherPort } from '../../domain/ports/outbound/password-hasher.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { BREACHED_PASSWORD_PORT } from '../../../../shared/security/breached-password.port';
import type { IBreachedPasswordPort } from '../../../../shared/security/breached-password.port';
import { LoggerService } from '../../../../logger/logger.service';
import { CacheService } from '../../../../shared/cache/cache.service';
import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';

const userId = '11111111-1111-1111-1111-111111111111';
const user = User.reconstitute({
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

describe('SetupPasswordHandler', () => {
  let handler: SetupPasswordHandler;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockSetupRepo: jest.Mocked<IPasswordSetupRepository>;
  let mockHasher: jest.Mocked<IPasswordHasherPort>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockBreached: jest.Mocked<IBreachedPasswordPort>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCache: jest.Mocked<CacheService>;
  let mockCls: jest.Mocked<ClsService>;
  let mockEvent: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    mockUserRepo = {
      findById: jest.fn().mockResolvedValue(user),
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
    mockSetupRepo = {
      save: jest.fn(),
      findValid: jest.fn().mockResolvedValue({
        id: 'token-row-1',
        userId,
        type: 'setup',
        expiresAt: new Date(Date.now() + 3600_000),
      }),
      markUsed: jest.fn(),
      invalidateAllForUser: jest.fn(),
    };
    mockHasher = {
      hash: jest.fn().mockResolvedValue('hashed-pw'),
      compare: jest.fn(),
    };
    mockAudit = { log: jest.fn() };
    mockBreached = { isBreached: jest.fn().mockResolvedValue(false) };
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
    mockCls = {
      get: jest.fn().mockReturnValue('trace-1'),
    } as unknown as jest.Mocked<ClsService>;
    mockEvent = { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetupPasswordHandler,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: PASSWORD_SETUP_REPOSITORY, useValue: mockSetupRepo },
        { provide: PASSWORD_HASHER_PORT, useValue: mockHasher },
        { provide: BREACHED_PASSWORD_PORT, useValue: mockBreached },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: EventEmitter2, useValue: mockEvent },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ClsService, useValue: mockCls },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    handler = module.get(SetupPasswordHandler);
  });

  it('sets password, audits, emits event and invalidates cache', async () => {
    await handler.execute(
      new SetupPasswordCommand({
        token: 'raw-token',
        password: 'StrongPassw0rd!',
        passwordConfirmation: 'StrongPassw0rd!',
      }),
    );

    expect(mockHasher.hash).toHaveBeenCalledWith('StrongPassw0rd!');
    expect(mockUserRepo.save).toHaveBeenCalledTimes(1);
    expect(mockSetupRepo.markUsed).toHaveBeenCalledWith('token-row-1');
    expect(mockCache.del).toHaveBeenCalledWith(`users-service:user:${userId}`);
    expect(mockCache.delByPattern).toHaveBeenCalledWith(
      'users-service:users:list:*',
    );
    expect(mockEvent.emit).toHaveBeenCalledWith(
      'users.password_setup',
      expect.objectContaining({ userId }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.password_setup',
        resourceType: 'USER',
        resourceId: userId,
      }),
      { strict: true },
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'SetupPasswordHandler start',
      expect.any(Object),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'SetupPasswordHandler end',
      expect.any(Object),
    );
  });

  it('rejects breached passwords without touching DB', async () => {
    mockBreached.isBreached.mockResolvedValueOnce(true);
    await expect(
      handler.execute(
        new SetupPasswordCommand({
          token: 'raw-token',
          password: 'password',
          passwordConfirmation: 'password',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockUserRepo.save).not.toHaveBeenCalled();
    expect(mockSetupRepo.markUsed).not.toHaveBeenCalled();
    expect(mockAudit.log).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException for invalid/expired token', async () => {
    mockSetupRepo.findValid.mockResolvedValueOnce(null);
    await expect(
      handler.execute(
        new SetupPasswordCommand({
          token: 'x',
          password: 'StrongPassw0rd!',
          passwordConfirmation: 'StrongPassw0rd!',
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
