jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_t: unknown, _k: string, d: PropertyDescriptor) => d,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';

import { BulkDeleteUsersHandler } from '../../application/commands/handlers/bulk-delete-users.handler';
import { BulkDeleteUsersCommand } from '../../application/commands/bulk-delete-users.command';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../logger/logger.service';
import { CacheService } from '../../../../shared/cache/cache.service';

describe('BulkDeleteUsersHandler', () => {
  let handler: BulkDeleteUsersHandler;
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
      bulkDelete: jest.fn().mockResolvedValue({ count: 2 }),
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
        BulkDeleteUsersHandler,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ClsService, useValue: mockCls },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    handler = module.get(BulkDeleteUsersHandler);
  });

  it('issues a single updateMany via bulkDelete, audits once, invalidates list cache', async () => {
    const ids = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    ];

    const result = await handler.execute(
      new BulkDeleteUsersCommand(ids, 'actor-1'),
    );

    expect(result).toEqual({ count: 2 });
    expect(mockUserRepo.bulkDelete).toHaveBeenCalledTimes(1);
    expect(mockUserRepo.bulkDelete).toHaveBeenCalledWith(ids);
    expect(mockCache.delByPattern).toHaveBeenCalledTimes(1);
    expect(mockAudit.log).toHaveBeenCalledTimes(1);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.bulk_deleted',
        actorId: 'actor-1',
        metadata: { ids, count: 2 },
      }),
      { strict: true },
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'BulkDeleteUsersHandler start',
      expect.any(Object),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'BulkDeleteUsersHandler end',
      expect.any(Object),
    );
  });
});
