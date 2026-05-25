export class ListMyCampaignExportsQuery {
  constructor(
    public readonly actorId: string,
    public readonly options: { limit?: number; offset?: number } = {},
  ) {}
}
