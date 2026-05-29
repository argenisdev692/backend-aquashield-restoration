import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { LoggerService } from '../../../../../logger/logger.service';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { CAMPAIGN_GENERATION_REPOSITORY } from '../../../domain/ports/campaign-generation.repository.port';
import type { ICampaignGenerationRepository } from '../../../domain/ports/campaign-generation.repository.port';
import { BulkDeleteCampaignsCommand } from '../bulk-delete-campaigns.command';

@Injectable()
@CommandHandler(BulkDeleteCampaignsCommand)
export class BulkDeleteCampaignsHandler
  implements ICommandHandler<BulkDeleteCampaignsCommand>
{
  constructor(
    @Inject(CAMPAIGN_GENERATION_REPOSITORY)
    private readonly campaignRepo: ICampaignGenerationRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(BulkDeleteCampaignsHandler.name);
  }

  @Transactional()
  async execute(command: BulkDeleteCampaignsCommand): Promise<{ count: number }> {
    const { dto, actorId } = command;
    const { ids } = dto;

    this.logger.info('Bulk deleting campaign generations', {
      actorId,
      count: ids.length,
    });

    // Bulk hard delete
    const count = await this.campaignRepo.bulkHardDelete(ids);

    // Audit (single entry for bulk operation)
    await this.audit.log(
      {
        action: 'campaigns.bulk_deleted',
        actorId,
        metadata: {
          ids,
          count,
        },
      },
      { strict: true },
    );

    // Invalidate cache
    await this.cache.delByPattern(`campaigns:${actorId}:*`);

    this.logger.info('Campaign generations bulk deleted successfully', {
      actorId,
      count,
    });

    return { count };
  }
}
