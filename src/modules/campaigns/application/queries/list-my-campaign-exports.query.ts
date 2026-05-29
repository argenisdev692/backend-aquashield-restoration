import type { DateRange } from '../../../../shared/crud/date-range.util';

export class ListMyCampaignExportsQuery {
  constructor(
    public readonly actorId: string,
    public readonly options: {
      limit?: number;
      offset?: number;
      dateRange?: DateRange;
    } = {},
  ) {}
}
