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
import { RetellCallDeletedEvent } from '../../domain/events/retell-call-lifecycle.events';
import { RETELL_CALLS_CACHE_PATTERN } from '../retell-calls.constants';

@Injectable()
export class DeleteCallUseCase {
  constructor(
    @Inject(RETELL_CALL_REPOSITORY)
    private readonly repo: IRetellCallRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly events: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(DeleteCallUseCase.name);
  }

  async execute(id: string, actorId?: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Soft-deleting Retell call', { traceId, id, actorId });

    await this.persist(id, actorId);
    await this.cache.delByPattern(RETELL_CALLS_CACHE_PATTERN);
    this.events.emit(
      RetellCallDeletedEvent.eventName,
      new RetellCallDeletedEvent(id),
    );

    this.logger.info('Retell call soft-deleted', { traceId, id });
  }

  @Transactional()
  private async persist(id: string, actorId?: string): Promise<void> {
    const existing = await this.repo.findById(id, true);
    if (!existing) throw new RetellCallNotFoundException(id);

    await this.repo.softDelete(id);
    await this.audit.log(
      {
        action: 'call-records.deleted',
        actorId,
        resourceId: id,
        traceId: this.cls.get<string>('traceId'),
      },
      { strict: true },
    );
  }
}
