import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import {
  RETELL_CALL_REPOSITORY,
  type IRetellCallRepository,
  type UpsertCallResult,
} from '../../domain/repositories/retell-call-repository.interface';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../domain/ports/outbound/audit.port.interface';
import {
  CACHE_PORT,
  type ICachePort,
} from '../../../../shared/cache/cache.port';
import { RetellCallRecordedEvent } from '../../domain/events/retell-call-recorded.domain-event';
import { RETELL_CALLS_CACHE_PATTERN } from '../retell-calls.constants';
import { normalizeRetellCall } from '../retell-call-payload.mapper';
import type { RetellWebhookPayload } from '../dtos/retell-webhook.dto';

/** Retell event that carries the full, analyzed call (recording + summary). */
const HANDLED_EVENT = 'call_analyzed';

@Injectable()
export class IngestCallWebhookUseCase {
  constructor(
    @Inject(RETELL_CALL_REPOSITORY)
    private readonly repo: IRetellCallRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly events: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(IngestCallWebhookUseCase.name);
  }

  private get traceId(): string | undefined {
    return this.cls.get<string>('traceId');
  }

  /**
   * Persist (insert-or-update) the call. Emits `retell-call.recorded` ONLY on
   * a brand-new insert so Retell's webhook retries (up to 3x) never re-email.
   * Non-`call_analyzed` events are acked and ignored.
   */
  async execute(payload: RetellWebhookPayload): Promise<void> {
    if (payload.event !== HANDLED_EVENT) {
      this.logger.info('Retell webhook ignored — not call_analyzed', {
        traceId: this.traceId,
        event: payload.event,
        callId: payload.call.call_id,
      });
      return;
    }

    const result = await this.persist(payload);

    // Side-effects live OUTSIDE the tx — Postgres cannot un-send an email.
    await this.cache.delByPattern(RETELL_CALLS_CACHE_PATTERN);

    if (result.created) {
      this.events.emit(
        RetellCallRecordedEvent.eventName,
        new RetellCallRecordedEvent(result.record.id, result.record.callId),
      );
      this.logger.info('New Retell call recorded', {
        traceId: this.traceId,
        recordId: result.record.id,
        callId: result.record.callId,
      });
    }
  }

  @Transactional()
  private async persist(
    payload: RetellWebhookPayload,
  ): Promise<UpsertCallResult> {
    const input = normalizeRetellCall(payload.call);
    const result = await this.repo.upsertByCallId(input);

    // Fire-and-forget audit (strict:false): a webhook ingest must never 500
    // back to Retell and trigger its retry storm just because the audit row
    // failed to persist.
    await this.audit.log(
      {
        action: result.created
          ? 'call-records.ingested'
          : 'call-records.updated',
        resourceId: result.record.id,
        traceId: this.traceId,
        metadata: { callId: result.record.callId, event: payload.event },
      },
      { strict: false },
    );

    return result;
  }
}
