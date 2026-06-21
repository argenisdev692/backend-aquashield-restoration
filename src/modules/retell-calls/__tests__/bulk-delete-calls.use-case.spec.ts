jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BulkDeleteCallsUseCase } from '../application/use-cases/bulk-delete-calls.use-case';
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

describe('BulkDeleteCallsUseCase', () => {
  let useCase: BulkDeleteCallsUseCase;
  let repo: jest.Mocked<IRetellCallRepository>;
  let cache: jest.Mocked<ICachePort>;
  let events: jest.Mocked<EventEmitter2>;
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
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPattern: jest.fn() };
    events = { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkDeleteCallsUseCase,
        { provide: RETELL_CALL_REPOSITORY, useValue: repo },
        { provide: AUDIT_PORT, useValue: audit },
        { provide: CACHE_PORT, useValue: cache },
        { provide: EventEmitter2, useValue: events },
        {
          provide: LoggerService,
          useValue: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), setContext: jest.fn() },
        },
        { provide: ClsService, useValue: { get: jest.fn().mockReturnValue('trace-1') } },
      ],
    }).compile();

    useCase = module.get(BulkDeleteCallsUseCase);
  });

  it('audits + emits ONLY the ids that actually transitioned', async () => {
    repo.bulkSoftDelete.mockResolvedValue(['a', 'b']);

    const count = await useCase.execute(['a', 'b', 'c'], 'user-1');

    expect(count).toBe(2);
    expect(audit.log).toHaveBeenCalledWith(
      {
        action: 'call-records.bulk_deleted',
        actorId: 'user-1',
        traceId: 'trace-1',
        metadata: { ids: ['a', 'b'], count: 2 },
      },
      { strict: true },
    );
    expect(events.emit).toHaveBeenCalledWith(
      'retell-call.bulk_deleted',
      expect.objectContaining({ recordIds: ['a', 'b'] }),
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/retell/calls*');
  });

  it('skips audit + event when nothing matched, still invalidates cache', async () => {
    repo.bulkSoftDelete.mockResolvedValue([]);

    const count = await useCase.execute(['x'], 'user-1');

    expect(count).toBe(0);
    expect(audit.log).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
    expect(cache.delByPattern).toHaveBeenCalled();
  });
});
