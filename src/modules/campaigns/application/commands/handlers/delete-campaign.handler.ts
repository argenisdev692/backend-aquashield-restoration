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
import { DeleteCampaignCommand } from '../delete-campaign.command';

@Injectable()
@CommandHandler(DeleteCampaignCommand)
export class DeleteCampaignHandler implements ICommandHandler<DeleteCampaignCommand> {
  constructor(
    @Inject(CAMPAIGN_GENERATION_REPOSITORY)
    private readonly campaignRepo: ICampaignGenerationRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(DeleteCampaignHandler.name);
  }

  @Transactional()
  async execute(command: DeleteCampaignCommand): Promise<void> {
    const { id, actorId } = command;

    this.logger.info('Deleting campaign generation', { id, actorId });

    // Check if exists
    const campaign = await this.campaignRepo.findById(id);
    if (!campaign) {
      throw new Error('Campaign generation not found');
    }

    // Hard delete
    await this.campaignRepo.hardDelete(id);

    // Audit
    await this.audit.log(
      {
        action: 'campaign.deleted',
        actorId,
        resourceId: id,
        metadata: {
          companyName: campaign.companyNameSnapshot,
          niche: campaign.niche,
          stages: campaign.stages,
        },
      },
      { strict: true },
    );

    // Invalidate cache
    await this.cache.delByPattern(`campaigns:${actorId}:*`);

    this.logger.info('Campaign generation deleted successfully', {
      id,
      actorId,
    });
  }
}
