import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';

import { ExportUsersHandler } from '../../application/commands/handlers/export-users.handler';
import { ExportUsersCommand } from '../../application/commands/export-users.command';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../logger/logger.service';
import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';

describe('ExportUsersHandler', () => {
  let handler: ExportUsersHandler;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCls: jest.Mocked<ClsService>;

  beforeEach(async () => {
    const sample = User.reconstitute({
      id: UserId.reconstitute('11111111-1111-1111-1111-111111111111'),
      email: Email.create('a@example.com'),
      name: 'Alice',
      lastName: null,
      phone: null,
      password: null,
      emailVerifiedAt: null,
      passwordConfirmedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findAll: jest.fn().mockResolvedValue({ users: [sample], total: 1 }),
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
    } as unknown as jest.Mocked<LoggerService>;
    mockCls = {
      get: jest.fn().mockReturnValue('trace-1'),
    } as unknown as jest.Mocked<ClsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportUsersHandler,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ClsService, useValue: mockCls },
      ],
    }).compile();

    handler = module.get(ExportUsersHandler);
  });

  it('produces a non-empty xlsx buffer and audits users.export', async () => {
    const buf = await handler.execute(
      new ExportUsersCommand(
        { page: 1, limit: 20, search: undefined },
        'xlsx',
        'actor-1',
      ),
    );

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.byteLength).toBeGreaterThan(0);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.export',
        resourceType: 'USER',
        actorId: 'actor-1',
        metadata: expect.objectContaining({ format: 'xlsx', rowCount: 1 }),
      }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'ExportUsersHandler start',
      expect.any(Object),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'ExportUsersHandler end',
      expect.any(Object),
    );
  });
});
