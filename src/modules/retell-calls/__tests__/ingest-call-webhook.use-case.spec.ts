jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IngestCallWebhookUseCase } from '../application/use-cases/ingest-call-webhook.use-case';
import {
  RETELL_CALL_REPOSITORY,
  type IRetellCallRepository,
  type RetellCallReadModel,
  type UpsertCallResult,
} from '../domain/repositories/retell-call-repository.interface';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../domain/ports/outbound/audit.port.interface';
import { CACHE_PORT, type ICachePort } from '../../../shared/cache/cache.port';
import { LoggerService } from '../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { RetellCallRecordedEvent } from '../domain/events/retell-call-recorded.domain-event';
import type { RetellWebhookPayload } from '../application/dtos/retell-webhook.dto';

const READ_MODEL: RetellCallReadModel = {
  id: 'rec-1',
  callId: 'call-1',
  agentId: 'agent-1',
  callType: 'phone_call',
  direction: 'inbound',
  fromNumber: '+12137771234',
  toNumber: '+12137771235',
  callStatus: 'ended',
  disconnectionReason: 'agent_hangup',
  startedAt: new Date('2026-06-01T10:00:00Z'),
  endedAt: new Date('2026-06-01T10:00:10Z'),
  durationMs: 10000,
  userSentiment: 'Positive',
  callSummary: 'Booked an appointment.',
  transcript: 'hi there',
  recordingUrl: 'https://recordings.retell/call-1.wav',
  isRead: false,
  createdAt: new Date('2026-06-01T10:00:11Z'),
  updatedAt: new Date('2026-06-01T10:00:11Z'),
  deletedAt: null,
};

function payload(event: string): RetellWebhookPayload {
  return {
    event,
    call: { call_id: 'call-1', recording_url: READ_MODEL.recordingUrl ?? '' },
  };
}

describe('IngestCallWebhookUseCase', () => {
  let useCase: IngestCallWebhookUseCase;
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
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
    };
    events = { emit: jest.fn() };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestCallWebhookUseCase,
        { provide: RETELL_CALL_REPOSITORY, useValue: repo },
        { provide: AUDIT_PORT, useValue: audit },
        { provide: CACHE_PORT, useValue: cache },
        { provide: EventEmitter2, useValue: events },
        {
          provide: LoggerService,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            setContext: jest.fn(),
          },
        },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-1') },
        },
      ],
    }).compile();

    useCase = module.get(IngestCallWebhookUseCase);
  });

  it('persists and emits recorded event on a NEW call', async () => {
    repo.upsertByCallId.mockResolvedValue({
      record: READ_MODEL,
      created: true,
    } satisfies UpsertCallResult);

    await useCase.execute(payload('call_analyzed'));

    expect(repo.upsertByCallId).toHaveBeenCalledTimes(1);
    expect(cache.delByPattern).toHaveBeenCalledWith('http:*:/retell/calls*');
    expect(events.emit).toHaveBeenCalledWith(
      RetellCallRecordedEvent.eventName,
      expect.objectContaining({ recordId: 'rec-1', callId: 'call-1' }),
    );
  });

  it('does NOT emit on a webhook re-delivery (already exists)', async () => {
    repo.upsertByCallId.mockResolvedValue({
      record: READ_MODEL,
      created: false,
    });

    await useCase.execute(payload('call_analyzed'));

    expect(repo.upsertByCallId).toHaveBeenCalledTimes(1);
    expect(cache.delByPattern).toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('ignores non call_analyzed events without touching the DB', async () => {
    await useCase.execute(payload('call_started'));

    expect(repo.upsertByCallId).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
