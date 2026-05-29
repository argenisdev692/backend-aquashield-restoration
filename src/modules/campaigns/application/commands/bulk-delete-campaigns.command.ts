import type { BulkDeleteCampaignsDto } from '../dtos/bulk-delete-campaigns.dto';

export class BulkDeleteCampaignsCommand {
  constructor(
    public readonly dto: BulkDeleteCampaignsDto,
    public readonly actorId: string,
  ) {}
}
