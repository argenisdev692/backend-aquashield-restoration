jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RestoreCallUseCase } from '../application/use-cases/restore-call.use-case';
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

describe('RestoreCallUseCase', () => {
  let useCase: RestoreCallUseCase;
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
      restore: jest.fn().mockResolvedValue(true),
      bulkSoftDelete: jest.fn(),
      bulkRestore: jest.fn(),
    };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPattern: jest.fn() };
    events = { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestoreCallUseCase,
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

    useCase = module.get(RestoreCallUseCase);
  });

  it('restores, audits (strict), invalidates cache and emits', async () => {
    await useCase.execute('rec-1', 'user-1');

    expect(repo.restore).toHaveBeenCalledWith('rec-1');
    expect(audit.log).toHaveBeenCalledWith(
      { action: 'call-records.restored', actorId: 'user-1', resourceId: 'rec-1', traceId: 'trace-1' },
      { strict: true },
    );
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/retell/calls*');
    expect(events.emit).toHaveBeenCalledWith(
      'retell-call.restored',
      expect.objectContaining({ recordId: 'rec-1' }),
    );
  });

  it('throws and skips audit/event when no deleted row matched', async () => {
    repo.restore.mockResolvedValue(false);

    await expect(useCase.execute('missing', 'user-1')).rejects.toThrow(
      'Retell call missing not found',
    );
    expect(audit.log).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
