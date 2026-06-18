import { Injectable, Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../shared/cache/cache.port';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import type { IContactSupportRepository } from '../../domain/ports/contact-support.repository.interface';
import { CONTACT_SUPPORT_CACHE_PATTERN } from '../contact-support.constants';

@Injectable()
export class BulkDeleteContactSupportUseCase {
  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(BulkDeleteContactSupportUseCase.name);
  }

  async execute(
    ids: string[],
    actorId: string,
  ): Promise<{ count: number }> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BulkDeleteContactSupportUseCase start', {
      traceId,
      actorId,
      idsCount: ids.length,
    });

    const { count } = await this.persist(ids, actorId);

    // Cache invalidation runs OUTSIDE the tx.
    await this.cache.delByPattern(CONTACT_SUPPORT_CACHE_PATTERN);

    this.logger.info('BulkDeleteContactSupportUseCase end', { traceId, count });
    return { count };
  }

  @Transactional()
  private async persist(
    ids: string[],
    actorId: string,
  ): Promise<{ count: number }> {
    const { count } = await this.repo.bulkDelete(ids);

    await this.audit.log(
      {
        action: 'contact_support.bulk_deleted',
        actorId,
        resourceType: 'CONTACT',
        resourceId: ids.length === 1 ? ids[0] : undefined,
        metadata: { ids, count },
      },
      { strict: true },
    );

    return { count };
  }
}
