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
import { RetellCallsBulkDeletedEvent } from '../../domain/events/retell-call-lifecycle.events';
import { RETELL_CALLS_CACHE_PATTERN } from '../retell-calls.constants';

@Injectable()
export class BulkDeleteCallsUseCase {
  constructor(
    @Inject(RETELL_CALL_REPOSITORY)
    private readonly repo: IRetellCallRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly events: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(BulkDeleteCallsUseCase.name);
  }

  async execute(ids: readonly string[], actorId?: string): Promise<number> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Bulk soft-deleting Retell calls', {
      traceId,
      requested: ids.length,
      actorId,
    });

    const affected = await this.persist(ids, actorId);
    await this.cache.delByPattern(RETELL_CALLS_CACHE_PATTERN);
    if (affected.length > 0) {
      this.events.emit(
        RetellCallsBulkDeletedEvent.eventName,
        new RetellCallsBulkDeletedEvent(affected),
      );
    }

    this.logger.info('Retell calls bulk soft-deleted', {
      traceId,
      count: affected.length,
    });
    return affected.length;
  }

  @Transactional()
  private async persist(
    ids: readonly string[],
    actorId?: string,
  ): Promise<string[]> {
    const affected = await this.repo.bulkSoftDelete(ids);
    if (affected.length === 0) return affected;
    await this.audit.log(
      {
        action: 'call-records.bulk_deleted',
        actorId,
        traceId: this.cls.get<string>('traceId'),
        metadata: { ids: affected, count: affected.length },
      },
      { strict: true },
    );
    return affected;
  }
}
