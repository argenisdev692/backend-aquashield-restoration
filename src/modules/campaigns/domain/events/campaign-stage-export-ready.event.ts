export class CampaignStageExportReadyEvent {
  constructor(
    public readonly generationId: string,
    public readonly stage: string,
    public readonly zipUrl: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
