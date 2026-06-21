import { Test, TestingModule } from '@nestjs/testing';
import { GetCallByIdUseCase } from '../application/use-cases/get-call-by-id.use-case';
import {
  RETELL_CALL_REPOSITORY,
  type IRetellCallRepository,
  type RetellCallReadModel,
} from '../domain/repositories/retell-call-repository.interface';
import { LoggerService } from '../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

describe('GetCallByIdUseCase', () => {
  let useCase: GetCallByIdUseCase;
  let repo: jest.Mocked<IRetellCallRepository>;

  beforeEach(async () => {
    repo = {
      upsertByCallId: jest.fn(),
      findById: jest.fn(),
      paginate: jest.fn(),
      findForExport: jest.fn(),
      markRead: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      bulkSoftDelete: jest.fn(),
      bulkRestore: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetCallByIdUseCase,
        { provide: RETELL_CALL_REPOSITORY, useValue: repo },
        {
          provide: LoggerService,
          useValue: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), setContext: jest.fn() },
        },
        { provide: ClsService, useValue: { get: jest.fn().mockReturnValue('trace-1') } },
      ],
    }).compile();

    useCase = module.get(GetCallByIdUseCase);
  });

  it('returns the record and forwards the withTrashed flag', async () => {
    const record = { id: 'rec-1' } as RetellCallReadModel;
    repo.findById.mockResolvedValue(record);

    const result = await useCase.execute('rec-1', false);

    expect(result).toBe(record);
    expect(repo.findById).toHaveBeenCalledWith('rec-1', false);
  });

  it('throws RetellCallNotFoundException when absent', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(
      'Retell call missing not found',
    );
  });
});
