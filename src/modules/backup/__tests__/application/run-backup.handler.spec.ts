jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () =>
    (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs') as Record<string, unknown>;
  return {
    ...actual,
    promises: {
      unlink: jest.fn().mockResolvedValue(undefined),
    },
  };
});

import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import type { ICachePort } from '../../../../shared/cache/cache.port';
import type { IBackupRepository } from '../../domain/ports/backup.repository.interface';
import type { IDbDumper } from '../../domain/ports/db-dumper.port';
import type { IBackupStoragePort } from '../../domain/ports/backup-storage.port';
import { Backup } from '../../domain/entities/backup.aggregate';
import { BackupId } from '../../domain/value-objects/backup-id.vo';
import { BackupTrigger } from '../../domain/value-objects/backup-status.vo';
import { RunBackupCommand } from '../../application/commands/run-backup.command';
import { RunBackupHandler } from '../../application/commands/handlers/run-backup.handler';

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
    get: jest.fn().mockReturnValue('trace-xyz'),
    isActive: jest.fn().mockReturnValue(true),
  } as unknown as ClsService;
}

describe('RunBackupHandler', () => {
  let repo: jest.Mocked<IBackupRepository>;
  let dumper: jest.Mocked<IDbDumper>;
  let storage: jest.Mocked<IBackupStoragePort>;
  let audit: jest.Mocked<IAuditPort>;
  let cache: jest.Mocked<ICachePort>;
  let events: EventEmitter2;
  let emitSpy: jest.SpyInstance;
  let handler: RunBackupHandler;

  beforeEach(() => {
    let savedBackup: Backup | null = null;
    repo = {
      create: jest.fn().mockImplementation(async (b: Backup) => {
        savedBackup = b;
      }),
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockImplementation(async (id: string) => {
        if (!savedBackup) return null;
        return Backup.reconstitute({
          id: BackupId.reconstitute(id),
          status: savedBackup.status,
          triggeredBy: savedBackup.triggeredBy,
          actorId: savedBackup.actorId,
          objectKey: savedBackup.objectKey,
          sizeBytes: savedBackup.sizeBytes,
          checksum: savedBackup.checksum,
          error: savedBackup.error,
          startedAt: savedBackup.startedAt,
          completedAt: savedBackup.completedAt,
          createdAt: savedBackup.createdAt,
        });
      }),
      findReadModelById: jest.fn(),
      findAll: jest.fn(),
      findAllForExport: jest.fn(),
      findCompletedBeyond: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IBackupRepository>;

    dumper = {
      dump: jest.fn().mockResolvedValue({
        filePath: '/tmp/backup-x.dump',
        sizeBytes: 9_999,
        checksum: 'sha256hex',
      }),
    };

    storage = {
      uploadFromFile: jest
        .fn()
        .mockResolvedValue({ objectKey: 'backups/2026/05/24/x.dump' }),
      delete: jest.fn().mockResolvedValue(undefined),
      download: jest.fn(),
    };

    audit = { log: jest.fn().mockResolvedValue(undefined) } as jest.Mocked<IAuditPort>;

    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<ICachePort>;

    events = new EventEmitter2();
    emitSpy = jest.spyOn(events, 'emit');

    handler = new RunBackupHandler(
      repo,
      dumper,
      storage,
      audit,
      cache,
      mockLogger(),
      mockCls(),
      events,
    );
  });

  it('persists PENDING → uploads → flips to COMPLETED with full audit trail', async () => {
    const id = await handler.execute(
      new RunBackupCommand(BackupTrigger.Manual, 'actor-1'),
    );

    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(dumper.dump).toHaveBeenCalledWith(id);
    expect(storage.uploadFromFile).toHaveBeenCalledWith({
      backupId: id,
      filePath: '/tmp/backup-x.dump',
      sizeBytes: 9_999,
    });
    expect(repo.save).toHaveBeenCalledTimes(1);

    // Two audit rows: triggered + completed, both strict.
    expect(audit.log).toHaveBeenCalledTimes(2);
    expect(audit.log).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ action: 'backups.triggered' }),
      { strict: true },
    );
    expect(audit.log).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: 'backups.completed',
        resourceType: 'DATABASE_BACKUP',
      }),
      { strict: true },
    );

    expect(emitSpy).toHaveBeenCalledWith(
      'backup.completed',
      expect.objectContaining({
        backupId: id,
        objectKey: 'backups/2026/05/24/x.dump',
        sizeBytes: 9_999,
      }),
    );

    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/backups*');
  });

  it('flips the row to FAILED when pg_dump throws, audits + emits failure', async () => {
    dumper.dump.mockRejectedValueOnce(new Error('pg_dump exited with code=1'));

    await expect(
      handler.execute(new RunBackupCommand(BackupTrigger.Scheduler, null)),
    ).rejects.toThrow('pg_dump exited with code=1');

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledTimes(2);
    expect(audit.log).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ action: 'backups.failed' }),
      { strict: true },
    );
    expect(emitSpy).toHaveBeenCalledWith(
      'backup.failed',
      expect.objectContaining({ error: 'pg_dump exited with code=1' }),
    );
    expect(storage.uploadFromFile).not.toHaveBeenCalled();
  });

  it('passes triggeredBy=SCHEDULER + actorId=null through to the PENDING row', async () => {
    await handler.execute(new RunBackupCommand(BackupTrigger.Scheduler, null));
    const persisted = repo.create.mock.calls[0]![0];
    expect(persisted.triggeredBy).toBe(BackupTrigger.Scheduler);
    expect(persisted.actorId).toBeNull();
  });
});
