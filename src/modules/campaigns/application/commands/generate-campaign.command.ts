import type { GenerateCampaignDto } from '../dtos/generate-campaign.dto';

export class GenerateCampaignCommand {
  constructor(
    public readonly dto: GenerateCampaignDto,
    public readonly actorId: string,
  ) {}
}
