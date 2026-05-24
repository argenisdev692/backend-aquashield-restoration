import { Readable } from 'node:stream';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IBackupRepository } from '../../domain/ports/backup.repository.interface';
import type { IBackupStoragePort } from '../../domain/ports/backup-storage.port';
import { Backup } from '../../domain/entities/backup.aggregate';
import { BackupId } from '../../domain/value-objects/backup-id.vo';
import {
  BackupStatus,
  BackupTrigger,
} from '../../domain/value-objects/backup-status.vo';
import {
  BackupNotDownloadableException,
  BackupNotFoundException,
} from '../../domain/exceptions/backup-domain.exception';
import { GetBackupDownloadQuery } from '../../application/queries/get-backup-download.query';
import { GetBackupDownloadHandler } from '../../application/queries/handlers/get-backup-download.handler';

const BACKUP_ID = '01950000-0000-7000-8000-000000000001';
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
    get: jest.fn().mockReturnValue('trace-dl'),
    isActive: jest.fn().mockReturnValue(true),
  } as unknown as ClsService;
}

function backup(opts: {
  status: BackupStatus;
  objectKey: string | null;
}): Backup {
  return Backup.reconstitute({
    id: BackupId.reconstitute(BACKUP_ID),
    status: opts.status,
    triggeredBy: BackupTrigger.Manual,
    actorId: 'actor-1',
    objectKey: opts.objectKey,
    sizeBytes: 12345,
    checksum: 'deadbeef',
    error: null,
    startedAt: new Date('2026-05-24T00:00:00Z'),
    completedAt: new Date('2026-05-24T00:01:00Z'),
    createdAt: new Date('2026-05-24T00:00:00Z'),
  });
}

describe('GetBackupDownloadHandler', () => {
  let repo: jest.Mocked<IBackupRepository>;
  let storage: jest.Mocked<IBackupStoragePort>;
  let handler: GetBackupDownloadHandler;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findReadModelById: jest.fn(),
      findAll: jest.fn(),
      findAllForExport: jest.fn(),
      findCompletedBeyond: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IBackupRepository>;

    storage = {
      uploadFromFile: jest.fn(),
      delete: jest.fn(),
      download: jest.fn(),
    };

    handler = new GetBackupDownloadHandler(
      repo,
      storage,
      mockLogger(),
      mockCls(),
    );
  });

  it('streams the artifact for a COMPLETED backup with a friendly filename', async () => {
    repo.findById.mockResolvedValueOnce(
      backup({ status: BackupStatus.Completed, objectKey: OBJECT_KEY }),
    );
    const body = Readable.from(Buffer.from('payload'));
    storage.download.mockResolvedValueOnce({ body, contentLength: 7 });

    const result = await handler.execute(new GetBackupDownloadQuery(BACKUP_ID));

    expect(storage.download).toHaveBeenCalledWith(OBJECT_KEY);
    expect(result.body).toBe(body);
    expect(result.contentLength).toBe(7);
    expect(result.filename).toBe(
      `backup-${BACKUP_ID}-2026-05-24T00:00:00.000Z.dump`,
    );
  });

  it('throws BackupNotFoundException when the row is missing', async () => {
    repo.findById.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new GetBackupDownloadQuery(BACKUP_ID)),
    ).rejects.toBeInstanceOf(BackupNotFoundException);

    expect(storage.download).not.toHaveBeenCalled();
  });

  it('throws BackupNotDownloadableException for a FAILED row', async () => {
    repo.findById.mockResolvedValueOnce(
      backup({ status: BackupStatus.Failed, objectKey: null }),
    );

    await expect(
      handler.execute(new GetBackupDownloadQuery(BACKUP_ID)),
    ).rejects.toBeInstanceOf(BackupNotDownloadableException);

    expect(storage.download).not.toHaveBeenCalled();
  });

  it('throws BackupNotDownloadableException when COMPLETED but objectKey is null', async () => {
    repo.findById.mockResolvedValueOnce(
      backup({ status: BackupStatus.Completed, objectKey: null }),
    );

    await expect(
      handler.execute(new GetBackupDownloadQuery(BACKUP_ID)),
    ).rejects.toBeInstanceOf(BackupNotDownloadableException);
  });
});
