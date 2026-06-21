jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BulkRestoreCallsUseCase } from '../application/use-cases/bulk-restore-calls.use-case';
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

describe('BulkRestoreCallsUseCase', () => {
  let useCase: BulkRestoreCallsUseCase;
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
        BulkRestoreCallsUseCase,
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

    useCase = module.get(BulkRestoreCallsUseCase);
  });

  it('audits + emits ONLY the ids that actually transitioned', async () => {
    repo.bulkRestore.mockResolvedValue(['a']);

    const count = await useCase.execute(['a', 'b'], 'user-1');

    expect(count).toBe(1);
    expect(audit.log).toHaveBeenCalledWith(
      {
        action: 'call-records.bulk_restored',
        actorId: 'user-1',
        traceId: 'trace-1',
        metadata: { ids: ['a'], count: 1 },
      },
      { strict: true },
    );
    expect(events.emit).toHaveBeenCalledWith(
      'retell-call.bulk_restored',
      expect.objectContaining({ recordIds: ['a'] }),
    );
  });

  it('skips audit + event when nothing matched', async () => {
    repo.bulkRestore.mockResolvedValue([]);

    const count = await useCase.execute(['x'], 'user-1');

    expect(count).toBe(0);
    expect(audit.log).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
