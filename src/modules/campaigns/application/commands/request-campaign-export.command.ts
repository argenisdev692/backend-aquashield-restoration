import type { RequestCampaignExportDto } from '../dtos/request-campaign-export.dto';

export class RequestCampaignExportCommand {
  constructor(
    public readonly dto: RequestCampaignExportDto,
    public readonly actorId: string,
  ) {}
}
