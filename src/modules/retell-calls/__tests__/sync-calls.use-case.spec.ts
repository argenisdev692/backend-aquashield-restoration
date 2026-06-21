jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { SyncCallsUseCase } from '../application/use-cases/sync-calls.use-case';
import {
  RETELL_CALL_REPOSITORY,
  type IRetellCallRepository,
} from '../domain/repositories/retell-call-repository.interface';
import {
  RETELL_API_PORT,
  type IRetellApiPort,
} from '../domain/ports/outbound/retell-api.port.interface';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../domain/ports/outbound/audit.port.interface';
import { CACHE_PORT, type ICachePort } from '../../../shared/cache/cache.port';
import { LoggerService } from '../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import type { RetellCallObject } from '../application/dtos/retell-webhook.dto';

describe('SyncCallsUseCase', () => {
  let useCase: SyncCallsUseCase;
  let repo: jest.Mocked<IRetellCallRepository>;
  let retell: jest.Mocked<IRetellApiPort>;
  let cache: jest.Mocked<ICachePort>;
  let audit: jest.Mocked<IAuditPort>;

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
    retell = { listCalls: jest.fn(), getCall: jest.fn() };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPattern: jest.fn() };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncCallsUseCase,
        { provide: RETELL_CALL_REPOSITORY, useValue: repo },
        { provide: RETELL_API_PORT, useValue: retell },
        { provide: AUDIT_PORT, useValue: audit },
        { provide: CACHE_PORT, useValue: cache },
        {
          provide: LoggerService,
          useValue: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), setContext: jest.fn() },
        },
        { provide: ClsService, useValue: { get: jest.fn().mockReturnValue('trace-1') } },
      ],
    }).compile();

    useCase = module.get(SyncCallsUseCase);
  });

  it('counts created vs updated, audits (fire-and-forget) and invalidates cache', async () => {
    const calls = [{ call_id: 'c1' }, { call_id: 'c2' }] as RetellCallObject[];
    retell.listCalls.mockResolvedValue(calls);
    repo.upsertByCallId
      .mockResolvedValueOnce({ record: { id: 'r1' } as never, created: true })
      .mockResolvedValueOnce({ record: { id: 'r2' } as never, created: false });

    const result = await useCase.execute(50, 'user-1');

    expect(result).toEqual({ fetched: 2, created: 1, updated: 1 });
    expect(retell.listCalls).toHaveBeenCalledWith({ limit: 50 });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'call-records.synced' }),
      { strict: false },
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/retell/calls*');
  });
});
