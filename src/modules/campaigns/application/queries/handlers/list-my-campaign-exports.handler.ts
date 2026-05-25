import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { ListMyCampaignExportsQuery } from '../list-my-campaign-exports.query';
import { CAMPAIGN_GENERATION_REPOSITORY } from '../../../domain/ports/campaign-generation.repository.port';
import type { ICampaignGenerationRepository } from '../../../domain/ports/campaign-generation.repository.port';
import type { CampaignExportListItem } from '../../dtos/campaign-export-response.dto';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@QueryHandler(ListMyCampaignExportsQuery)
@Injectable()
export class ListMyCampaignExportsHandler
  implements IQueryHandler<ListMyCampaignExportsQuery>
{
  constructor(
    @Inject(CAMPAIGN_GENERATION_REPOSITORY)
    private readonly campaignRepo: ICampaignGenerationRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ListMyCampaignExportsHandler.name);
  }

  async execute(
    query: ListMyCampaignExportsQuery,
  ): Promise<CampaignExportListItem[]> {
    const traceId = this.cls.get<string>('traceId');
    const { actorId, options } = query;
    const { limit = 20, offset = 0 } = options;

    this.logger.info('ListMyCampaignExportsHandler', {
      traceId,
      actorId,
      limit,
      offset,
    });

    const aggregates = await this.campaignRepo.findByUserId(actorId, {
      limit,
      offset,
      withTrashed: false,
    });

    const items: CampaignExportListItem[] = aggregates.map((agg) => {
      const stagesRequested = agg.stages.length;
      const stagesCompleted = agg.stageResults.filter((r) => r.isSuccess()).length;
      const hasErrors = agg.stageResults.some((r) => r.isFailure());

      return {
        id: agg.id!,
        companyName: agg.companyNameSnapshot,
        niche: agg.niche,
        status: agg.status,
        stagesRequested,
        stagesCompleted,
        hasErrors,
        createdAt: agg.createdAt.toISOString(),
      };
    });

    this.logger.info('ListMyCampaignExportsHandler completed', {
      traceId,
      actorId,
      count: items.length,
    });

    return items;
  }
}
