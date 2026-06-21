import { Test, TestingModule } from '@nestjs/testing';
import { GetCallsListUseCase } from '../application/use-cases/get-calls-list.use-case';
import {
  RETELL_CALL_REPOSITORY,
  type IRetellCallRepository,
  type PaginatedResult,
  type RetellCallReadModel,
} from '../domain/repositories/retell-call-repository.interface';
import { LoggerService } from '../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import type { CallFiltersInput } from '../application/dtos/call-filters.dto';

describe('GetCallsListUseCase', () => {
  let useCase: GetCallsListUseCase;
  let repo: jest.Mocked<IRetellCallRepository>;

  const EMPTY: PaginatedResult<RetellCallReadModel> = {
    data: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  beforeEach(async () => {
    repo = {
      upsertByCallId: jest.fn(),
      findById: jest.fn(),
      paginate: jest.fn().mockResolvedValue(EMPTY),
      findForExport: jest.fn(),
      markRead: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      bulkSoftDelete: jest.fn(),
      bulkRestore: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetCallsListUseCase,
        { provide: RETELL_CALL_REPOSITORY, useValue: repo },
        {
          provide: LoggerService,
          useValue: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), setContext: jest.fn() },
        },
        { provide: ClsService, useValue: { get: jest.fn().mockReturnValue('trace-1') } },
      ],
    }).compile();

    useCase = module.get(GetCallsListUseCase);
  });

  it('resolves trashed mode + date range and delegates to the repository', async () => {
    const filters = {
      page: 2,
      limit: 10,
      status: 'active',
      callStatus: 'ended',
    } as CallFiltersInput;

    const result = await useCase.execute(filters);

    expect(result).toBe(EMPTY);
    expect(repo.paginate).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 10, callStatus: 'ended' }),
      'exclude',
      expect.anything(),
    );
  });
});
