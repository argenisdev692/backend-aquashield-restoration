export class GetCampaignExportStatusQuery {
  constructor(
    public readonly generationId: string,
    public readonly actorId: string,
  ) {}
}
