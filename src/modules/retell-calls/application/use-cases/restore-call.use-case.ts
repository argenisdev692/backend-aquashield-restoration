import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import {
  RETELL_CALL_REPOSITORY,
  type IRetellCallRepository,
} from '../../domain/repositories/retell-call-repository.interface';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../domain/ports/outbound/audit.port.interface';
import {
  CACHE_PORT,
  type ICachePort,
} from '../../../../shared/cache/cache.port';
import { RetellCallNotFoundException } from '../../domain/exceptions/retell-call-domain.exception';
import { RetellCallRestoredEvent } from '../../domain/events/retell-call-lifecycle.events';
import { RETELL_CALLS_CACHE_PATTERN } from '../retell-calls.constants';

@Injectable()
export class RestoreCallUseCase {
  constructor(
    @Inject(RETELL_CALL_REPOSITORY)
    private readonly repo: IRetellCallRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly events: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(RestoreCallUseCase.name);
  }

  async execute(id: string, actorId?: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Restoring Retell call', { traceId, id, actorId });

    await this.persist(id, actorId);
    await this.cache.delByPattern(RETELL_CALLS_CACHE_PATTERN);
    this.events.emit(
      RetellCallRestoredEvent.eventName,
      new RetellCallRestoredEvent(id),
    );

    this.logger.info('Retell call restored', { traceId, id });
  }

  @Transactional()
  private async persist(id: string, actorId?: string): Promise<void> {
    // Honor the affected-row count: a missing OR not-deleted record yields
    // `false`, so we abort BEFORE writing an audit row / emitting an event.
    // This keeps restore idempotent (no spurious audit + WS broadcast).
    const restored = await this.repo.restore(id);
    if (!restored) throw new RetellCallNotFoundException(id);

    await this.audit.log(
      {
        action: 'call-records.restored',
        actorId,
        resourceId: id,
        traceId: this.cls.get<string>('traceId'),
      },
      { strict: true },
    );
  }
}
