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
    public readonly viralityScore: number | null = null,
    public readonly roiScore: number | null = null,
    public readonly aiDetectionScore: {
      aiGenerated: number;
      aiParaphrased: number;
      humanWritten: number;
      showsAiSigns: number;
    } | null = null,
    public readonly analysisReportUrl: string | null = null,
  ) {}
}
