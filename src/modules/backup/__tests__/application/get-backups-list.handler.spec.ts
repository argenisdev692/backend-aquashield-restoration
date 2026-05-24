import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type {
  IBackupRepository,
  PaginatedBackups,
} from '../../domain/ports/backup.repository.interface';
import { GetBackupsListQuery } from '../../application/queries/get-backups-list.query';
import { GetBackupsListHandler } from '../../application/queries/handlers/get-backups-list.handler';

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
    get: jest.fn().mockReturnValue('trace-list'),
    isActive: jest.fn().mockReturnValue(true),
  } as unknown as ClsService;
}

describe('GetBackupsListHandler', () => {
  let repo: jest.Mocked<IBackupRepository>;
  let handler: GetBackupsListHandler;

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

    handler = new GetBackupsListHandler(repo, mockLogger(), mockCls());
  });

  it('forwards page+limit to the repository and returns its paginated result', async () => {
    const expected: PaginatedBackups = { data: [], total: 0, page: 2, limit: 25 };
    repo.findAll.mockResolvedValueOnce(expected);

    const result = await handler.execute(new GetBackupsListQuery(2, 25));

    expect(repo.findAll).toHaveBeenCalledWith({ page: 2, limit: 25 });
    expect(result).toBe(expected);
  });
});
