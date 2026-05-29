import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { GenerateCampaignCommand } from '../generate-campaign.command';
import { CampaignRequestService } from '../../services/campaign-request.service';
import type { GenerateCampaignResponse } from '../../dtos/generate-campaign.dto';

/**
 * Step 2 of the 2-step flow (`POST /campaigns/generate-campaign`).
 *
 * Carries the selected `topicId` and `aiProvider`; otherwise identical to the
 * `/export` path, so it delegates to the shared {@link CampaignRequestService}.
 */
@CommandHandler(GenerateCampaignCommand)
@Injectable()
export class GenerateCampaignHandler
  implements ICommandHandler<GenerateCampaignCommand, GenerateCampaignResponse>
{
  constructor(private readonly campaignRequest: CampaignRequestService) {}

  @Transactional()
  async execute(
    command: GenerateCampaignCommand,
  ): Promise<GenerateCampaignResponse> {
    const { dto, actorId } = command;

    const generationId = await this.campaignRequest.requestGeneration({
      input: dto,
      actorId,
      auditAction: 'campaigns.generate_campaign',
      topicId: dto.topicId,
      auditMetadata: { topicId: dto.topicId, aiProvider: dto.aiProvider },
    });

    return { generationId, status: 'pending' };
  }
}
