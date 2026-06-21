import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import {
  RETELL_CALL_REPOSITORY,
  type IRetellCallRepository,
} from '../../domain/repositories/retell-call-repository.interface';
import {
  RETELL_API_PORT,
  type IRetellApiPort,
} from '../../domain/ports/outbound/retell-api.port.interface';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../domain/ports/outbound/audit.port.interface';
import {
  CACHE_PORT,
  type ICachePort,
} from '../../../../shared/cache/cache.port';
import { normalizeRetellCall } from '../retell-call-payload.mapper';
import { RETELL_CALLS_CACHE_PATTERN } from '../retell-calls.constants';

export interface SyncCallsResult {
  fetched: number;
  created: number;
  updated: number;
}

/**
 * Manual backfill from the Retell REST API. Unlike the webhook path it never
 * emits `retell-call.recorded` — re-importing historical calls must not spam
 * the company inbox with "new call" alerts.
 */
@Injectable()
export class SyncCallsUseCase {
  constructor(
    @Inject(RETELL_CALL_REPOSITORY)
    private readonly repo: IRetellCallRepository,
    @Inject(RETELL_API_PORT) private readonly retell: IRetellApiPort,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(SyncCallsUseCase.name);
  }

  async execute(limit = 100, actorId?: string): Promise<SyncCallsResult> {
    this.logger.info('Syncing Retell calls from REST API', {
      traceId: this.cls.get<string>('traceId'),
      limit,
      actorId,
    });
    const calls = await this.retell.listCalls({ limit });
    const result = await this.persist(calls, actorId);
    await this.cache.delByPattern(RETELL_CALLS_CACHE_PATTERN);
    this.logger.info('Retell sync complete', {
      traceId: this.cls.get<string>('traceId'),
      ...result,
    });
    return result;
  }

  @Transactional()
  private async persist(
    calls: Awaited<ReturnType<IRetellApiPort['listCalls']>>,
    actorId?: string,
  ): Promise<SyncCallsResult> {
    let created = 0;
    let updated = 0;
    for (const call of calls) {
      const { created: wasCreated } = await this.repo.upsertByCallId(
        normalizeRetellCall(call),
      );
      if (wasCreated) created += 1;
      else updated += 1;
    }

    await this.audit.log(
      {
        action: 'call-records.synced',
        actorId,
        traceId: this.cls.get<string>('traceId'),
        metadata: { fetched: calls.length, created, updated },
      },
      { strict: false },
    );

    return { fetched: calls.length, created, updated };
  }
}
