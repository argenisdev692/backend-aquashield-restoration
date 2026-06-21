jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { MarkCallReadUseCase } from '../application/use-cases/mark-call-read.use-case';
import {
  RETELL_CALL_REPOSITORY,
  type IRetellCallRepository,
} from '../domain/repositories/retell-call-repository.interface';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../domain/ports/outbound/audit.port.interface';
import { CACHE_PORT, type ICachePort } from '../../../shared/cache/cache.port';
import { LoggerService } from '../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

describe('MarkCallReadUseCase', () => {
  let useCase: MarkCallReadUseCase;
  let repo: jest.Mocked<IRetellCallRepository>;
  let cache: jest.Mocked<ICachePort>;
  let audit: jest.Mocked<IAuditPort>;

  beforeEach(async () => {
    repo = {
      upsertByCallId: jest.fn(),
      findById: jest.fn(),
      paginate: jest.fn(),
      findForExport: jest.fn(),
      markRead: jest.fn().mockResolvedValue(true),
      softDelete: jest.fn(),
      restore: jest.fn(),
      bulkSoftDelete: jest.fn(),
      bulkRestore: jest.fn(),
    };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPattern: jest.fn() };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarkCallReadUseCase,
        { provide: RETELL_CALL_REPOSITORY, useValue: repo },
        { provide: AUDIT_PORT, useValue: audit },
        { provide: CACHE_PORT, useValue: cache },
        {
          provide: LoggerService,
          useValue: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), setContext: jest.fn() },
        },
        { provide: ClsService, useValue: { get: jest.fn().mockReturnValue('trace-1') } },
      ],
    }).compile();

    useCase = module.get(MarkCallReadUseCase);
  });

  it('marks read, audits (strict) and invalidates cache', async () => {
    await useCase.execute('rec-1', 'user-1');

    expect(repo.markRead).toHaveBeenCalledWith('rec-1');
    expect(audit.log).toHaveBeenCalledWith(
      { action: 'call-records.read', actorId: 'user-1', resourceId: 'rec-1', traceId: 'trace-1' },
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/retell/calls*');
  });

  it('throws and skips audit when no live row matched', async () => {
    repo.markRead.mockResolvedValue(false);

    await expect(useCase.execute('missing', 'user-1')).rejects.toThrow(
      'Retell call missing not found',
    );
    expect(audit.log).not.toHaveBeenCalled();
  });
});
