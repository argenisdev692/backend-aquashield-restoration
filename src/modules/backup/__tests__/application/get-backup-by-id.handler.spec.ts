import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IBackupRepository } from '../../domain/ports/backup.repository.interface';
import type { BackupReadModel } from '../../domain/read-models/backup.read-model';
import {
  BackupStatus,
  BackupTrigger,
} from '../../domain/value-objects/backup-status.vo';
import { GetBackupByIdQuery } from '../../application/queries/get-backup-by-id.query';
import { GetBackupByIdHandler } from '../../application/queries/handlers/get-backup-by-id.handler';

const BACKUP_ID = '01950000-0000-7000-8000-000000000001';

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
    get: jest.fn().mockReturnValue('trace-q'),
    isActive: jest.fn().mockReturnValue(true),
  } as unknown as ClsService;
}

function readModel(): BackupReadModel {
  return {
    id: BACKUP_ID,
    status: BackupStatus.Completed,
    triggeredBy: BackupTrigger.Manual,
    actorId: 'actor-1',
    objectKey: 'backups/2026/05/24/abc.dump',
    sizeBytes: 12345,
    checksum: 'deadbeef',
    error: null,
    startedAt: new Date('2026-05-24T00:00:00Z'),
    completedAt: new Date('2026-05-24T00:01:00Z'),
    createdAt: new Date('2026-05-24T00:00:00Z'),
  };
}

describe('GetBackupByIdHandler', () => {
  let repo: jest.Mocked<IBackupRepository>;
  let handler: GetBackupByIdHandler;

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
    };

    handler = new GetBackupByIdHandler(repo, mockLogger(), mockCls());
  });

  it('returns the read model emitted by the repository', async () => {
    const rm = readModel();
    repo.findReadModelById.mockResolvedValueOnce(rm);

    const result = await handler.execute(new GetBackupByIdQuery(BACKUP_ID));

    expect(repo.findReadModelById).toHaveBeenCalledWith(BACKUP_ID);
    expect(result).toBe(rm);
  });

  it('returns null when the backup does not exist', async () => {
    repo.findReadModelById.mockResolvedValueOnce(null);

    const result = await handler.execute(new GetBackupByIdQuery(BACKUP_ID));

    expect(result).toBeNull();
  });
});
