import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IBackupRepository } from '../../domain/ports/backup.repository.interface';
import type { IBackupStoragePort } from '../../domain/ports/backup-storage.port';
import { BackupCompletedEvent } from '../../domain/events/backup-completed.domain-event';
import { BackupRetentionListener } from '../../infrastructure/event-listeners/backup-retention.listener';

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
    get: jest.fn().mockReturnValue('trace-retention'),
    isActive: jest.fn().mockReturnValue(true),
  } as unknown as ClsService;
}

function mockConfig(keep: number): ConfigService {
  return {
    get: jest.fn().mockReturnValue(keep),
  } as unknown as ConfigService;
}

describe('BackupRetentionListener', () => {
  let repo: jest.Mocked<IBackupRepository>;
  let storage: jest.Mocked<IBackupStoragePort>;
  let listener: BackupRetentionListener;

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
    } as jest.Mocked<IBackupRepository>;

    storage = {
      uploadFromFile: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      download: jest.fn(),
    };

    listener = new BackupRetentionListener(
      repo,
      storage,
      mockConfig(5),
      mockLogger(),
      mockCls(),
    );
  });

  it('queries findCompletedBeyond with the configured keep window', async () => {
    repo.findCompletedBeyond.mockResolvedValueOnce([]);

    await listener.handle(new BackupCompletedEvent('new-id', 'k', 1));

    expect(repo.findCompletedBeyond).toHaveBeenCalledWith(5);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('prunes each stale row: storage delete first, then repo delete', async () => {
    repo.findCompletedBeyond.mockResolvedValueOnce([
      { id: 'old-1', objectKey: 'backups/old/1.dump' },
      { id: 'old-2', objectKey: 'backups/old/2.dump' },
    ]);

    await listener.handle(new BackupCompletedEvent('new-id', 'k', 1));

    expect(storage.delete).toHaveBeenNthCalledWith(1, 'backups/old/1.dump');
    expect(storage.delete).toHaveBeenNthCalledWith(2, 'backups/old/2.dump');
    expect(repo.delete).toHaveBeenNthCalledWith(1, 'old-1');
    expect(repo.delete).toHaveBeenNthCalledWith(2, 'old-2');
  });

  it('continues pruning when a single row delete fails (best-effort)', async () => {
    repo.findCompletedBeyond.mockResolvedValueOnce([
      { id: 'old-1', objectKey: 'k1' },
      { id: 'old-2', objectKey: 'k2' },
    ]);
    repo.delete
      .mockRejectedValueOnce(new Error('FK violation'))
      .mockResolvedValueOnce(undefined);

    await expect(
      listener.handle(new BackupCompletedEvent('new-id', 'k', 1)),
    ).resolves.not.toThrow();

    expect(storage.delete).toHaveBeenCalledTimes(2);
    expect(repo.delete).toHaveBeenCalledTimes(2);
  });
});
