jest.mock('@nestjs-cls/transactional', () => ({
  Transactional: () => (_t: unknown, _k: string, d: PropertyDescriptor) => d,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';

import { RequestPasswordChangeHandler } from '../../application/commands/handlers/request-password-change.handler';
import { RequestPasswordChangeCommand } from '../../application/commands/request-password-change.command';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { PASSWORD_SETUP_REPOSITORY } from '../../domain/repositories/password-setup.repository.interface';
import type { IPasswordSetupRepository } from '../../domain/repositories/password-setup.repository.interface';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../logger/logger.service';
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
  password: 'h',
  emailVerifiedAt: null,
  passwordConfirmedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

describe('RequestPasswordChangeHandler', () => {
  let handler: RequestPasswordChangeHandler;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockSetupRepo: jest.Mocked<IPasswordSetupRepository>;
  let mockEmail: jest.Mocked<IEmailPort>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCls: jest.Mocked<ClsService>;
  let mockConfig: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(user),
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
      findValid: jest.fn(),
      markUsed: jest.fn(),
      invalidateAllForUser: jest.fn(),
    };
    mockEmail = { sendPasswordSetupLink: jest.fn() };
    mockAudit = { log: jest.fn() };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setContext: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;
    mockCls = {
      get: jest.fn().mockReturnValue('trace-1'),
    } as unknown as jest.Mocked<ClsService>;
    mockConfig = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestPasswordChangeHandler,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: PASSWORD_SETUP_REPOSITORY, useValue: mockSetupRepo },
        { provide: EMAIL_PORT, useValue: mockEmail },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: ConfigService, useValue: mockConfig },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ClsService, useValue: mockCls },
      ],
    }).compile();

    handler = module.get(RequestPasswordChangeHandler);
  });

  it('invalidates previous change tokens, saves new token, audits and sends email', async () => {
    await handler.execute(
      new RequestPasswordChangeCommand({ email: 'a@example.com' }),
    );

    expect(mockSetupRepo.invalidateAllForUser).toHaveBeenCalledWith(
      userId,
      'change',
    );
    expect(mockSetupRepo.save).toHaveBeenCalledTimes(1);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.password_change_requested',
        resourceId: userId,
      }),
      { strict: true },
    );
    expect(mockEmail.sendPasswordSetupLink).toHaveBeenCalledTimes(1);
  });

  it('returns silently (no email, no audit) for unknown email — does not reveal existence', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);

    await handler.execute(
      new RequestPasswordChangeCommand({ email: 'unknown@example.com' }),
    );

    expect(mockSetupRepo.save).not.toHaveBeenCalled();
    expect(mockEmail.sendPasswordSetupLink).not.toHaveBeenCalled();
    expect(mockAudit.log).not.toHaveBeenCalled();
  });
});
