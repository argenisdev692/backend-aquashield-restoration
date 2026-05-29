jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import type { ICachePort } from '../../../../shared/cache/cache.port';
import type { IBackupRepository } from '../../domain/ports/backup.repository.interface';
import type { IBackupStoragePort } from '../../domain/ports/backup-storage.port';
import { Backup } from '../../domain/entities/backup.aggregate';
import { BackupId } from '../../domain/value-objects/backup-id.vo';
import {
  BackupStatus,
  BackupTrigger,
} from '../../domain/value-objects/backup-status.vo';
import { BackupNotFoundException } from '../../domain/exceptions/backup-domain.exception';
import { DeleteBackupCommand } from '../../application/commands/delete-backup.command';
import { DeleteBackupHandler } from '../../application/commands/handlers/delete-backup.handler';

const BACKUP_ID = '01950000-0000-7000-8000-000000000001';
const ACTOR_ID = '01950000-0000-7000-8000-0000000000aa';
const OBJECT_KEY = 'backups/2026/05/24/abc.dump';

function mockLogger(): LoggerService {
  return {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as LoggerService;
}

function mockCls(): ClsService {
  return {
    get: jest.fn().mockReturnValue('trace-del'),
    isActive: jest.fn().mockReturnValue(true),
  } as unknown as ClsService;
}

function completedBackup(objectKey: string | null = OBJECT_KEY): Backup {
  return Backup.reconstitute({
    id: BackupId.reconstitute(BACKUP_ID),
    status: BackupStatus.Completed,
    triggeredBy: BackupTrigger.Manual,
    actorId: ACTOR_ID,
    objectKey,
    sizeBytes: 12345,
    checksum: 'deadbeef',
    error: null,
    startedAt: new Date('2026-05-24T00:00:00Z'),
    completedAt: new Date('2026-05-24T00:01:00Z'),
    createdAt: new Date('2026-05-24T00:00:00Z'),
  });
}

describe('DeleteBackupHandler', () => {
  let repo: jest.Mocked<IBackupRepository>;
  let storage: jest.Mocked<IBackupStoragePort>;
  let audit: jest.Mocked<IAuditPort>;
  let cache: jest.Mocked<ICachePort>;
  let handler: DeleteBackupHandler;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findReadModelById: jest.fn(),
      findAll: jest.fn(),
      findAllForExport: jest.fn(),
      findCompletedBeyond: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    storage = {
      uploadFromFile: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      download: jest.fn(),
    };

    audit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<ICachePort>;

    handler = new DeleteBackupHandler(
      repo,
      storage,
      audit,
      cache,
      mockLogger(),
      mockCls(),
    );
  });

  it('deletes the row, audits strict, invalidates cache, then deletes the R2 object', async () => {
    repo.findById.mockResolvedValueOnce(completedBackup());

    await handler.execute(new DeleteBackupCommand(BACKUP_ID, ACTOR_ID));

    expect(repo.delete).toHaveBeenCalledWith(BACKUP_ID);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'backups.deleted',
        actorId: ACTOR_ID,
        resourceType: 'DATABASE_BACKUP',
        resourceId: BACKUP_ID,
        metadata: { objectKey: OBJECT_KEY },
      }),
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/backups*');
    expect(storage.delete).toHaveBeenCalledWith(OBJECT_KEY);
  });

  it('skips storage.delete when the row had no objectKey (failed backup)', async () => {
    repo.findById.mockResolvedValueOnce(completedBackup(null));

    await handler.execute(new DeleteBackupCommand(BACKUP_ID, ACTOR_ID));

    expect(repo.delete).toHaveBeenCalledWith(BACKUP_ID);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('throws BackupNotFoundException when the row is missing', async () => {
    repo.findById.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new DeleteBackupCommand(BACKUP_ID, ACTOR_ID)),
    ).rejects.toBeInstanceOf(BackupNotFoundException);

    expect(repo.delete).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(cache.delByPattern).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
