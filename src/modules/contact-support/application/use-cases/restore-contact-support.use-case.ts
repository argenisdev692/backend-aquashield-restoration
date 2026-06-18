import { Injectable, Inject, NotFoundException } from '@nestjs/common';
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
export class RestoreContactSupportUseCase {
  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(RestoreContactSupportUseCase.name);
  }

  async execute(id: string, actorId: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RestoreContactSupportUseCase start', {
      traceId,
      id,
    });

    await this.persist(id, actorId);

    // Cache invalidation runs OUTSIDE the tx.
    await this.cache.delByPattern(CONTACT_SUPPORT_CACHE_PATTERN);

    this.logger.info('RestoreContactSupportUseCase end', {
      traceId,
      id,
    });
  }

  @Transactional()
  private async persist(id: string, actorId: string): Promise<void> {
    const entity = await this.repo.findByIdWithDeleted(id);
    if (!entity) throw new NotFoundException('Contact request not found');

    entity.restore();
    await this.repo.save(entity);

    await this.audit.log(
      {
        action: 'contact_support.restored',
        actorId,
        resourceType: 'CONTACT',
        resourceId: id,
      },
      { strict: true },
    );
  }
}
