/**
 * Domain Event — fired when a new campaign export request is accepted.
 * Listener(s) will typically enqueue the BullMQ job.
 */
export class CampaignExportRequestedEvent {
  constructor(
    public readonly generationId: string,
    public readonly userId: string,
    public readonly payload: {
      companyDataId: string;
      companyNameSnapshot: string;
      niche: string;
      location: string;
      city?: string;
      state?: string;
      country?: string;
      phone: string;
      website?: string;
      stages: string[];
      format: string;
      durationSeconds: number;
      language: string;
      generateImages: boolean;
      aiObservations?: string;
    },
    public readonly occurredAt: Date = new Date(),
  ) {}
}
