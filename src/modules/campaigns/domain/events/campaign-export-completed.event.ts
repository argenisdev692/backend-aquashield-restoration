/**
 * Domain Event — fired when the entire campaign export (all stages) has finished
 * processing (success, partial, or failed).
 */
export class CampaignExportCompletedEvent {
  constructor(
    public readonly generationId: string,
    public readonly userId: string,
    public readonly status: 'completed' | 'partial' | 'failed',
    public readonly errorMessage: string | null | undefined = undefined,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
