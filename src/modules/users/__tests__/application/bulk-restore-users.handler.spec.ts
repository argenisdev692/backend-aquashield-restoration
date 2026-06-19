jest.mock('@nestjs-cls/transactional', () => ({
  Transactional: () => (_t: unknown, _k: string, d: PropertyDescriptor) => d,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';

import { BulkRestoreUsersHandler } from '../../application/commands/handlers/bulk-restore-users.handler';
import { BulkRestoreUsersCommand } from '../../application/commands/bulk-restore-users.command';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../logger/logger.service';
import { CacheService } from '../../../../shared/cache/cache.service';

describe('BulkRestoreUsersHandler', () => {
  let handler: BulkRestoreUsersHandler;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCache: jest.Mocked<CacheService>;
  let mockCls: jest.Mocked<ClsService>;

  beforeEach(async () => {
    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      existsByEmail: jest.fn(),
      existsByUsername: jest.fn(),
      bulkDelete: jest.fn(),
      bulkRestore: jest.fn().mockResolvedValue({ count: 1 }),
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
        BulkRestoreUsersHandler,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ClsService, useValue: mockCls },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    handler = module.get(BulkRestoreUsersHandler);
  });

  it('issues a single bulkRestore and audits once', async () => {
    const ids = ['11111111-1111-1111-1111-111111111111'];
    const result = await handler.execute(
      new BulkRestoreUsersCommand(ids, 'actor-1'),
    );

    expect(result).toEqual({ count: 1 });
    expect(mockUserRepo.bulkRestore).toHaveBeenCalledTimes(1);
    expect(mockUserRepo.bulkRestore).toHaveBeenCalledWith(ids);
    expect(mockAudit.log).toHaveBeenCalledTimes(1);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.bulk_restored',
        metadata: { ids, count: 1 },
      }),
      { strict: true },
    );
  });
});
