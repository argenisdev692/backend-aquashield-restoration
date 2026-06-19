import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
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
import { RETELL_CALLS_CACHE_PATTERN } from '../retell-calls.constants';

@Injectable()
export class MarkCallReadUseCase {
  constructor(
    @Inject(RETELL_CALL_REPOSITORY)
    private readonly repo: IRetellCallRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(MarkCallReadUseCase.name);
  }

  async execute(id: string, actorId?: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Marking Retell call as read', { traceId, id, actorId });

    await this.persist(id, actorId);
    await this.cache.delByPattern(RETELL_CALLS_CACHE_PATTERN);

    this.logger.info('Retell call marked as read', { traceId, id });
  }

  @Transactional()
  private async persist(id: string, actorId?: string): Promise<void> {
    const updated = await this.repo.markRead(id);
    if (!updated) throw new RetellCallNotFoundException(id);

    await this.audit.log(
      {
        action: 'call-records.read',
        actorId,
        resourceId: id,
        traceId: this.cls.get<string>('traceId'),
      },
      { strict: true },
    );
  }
}
