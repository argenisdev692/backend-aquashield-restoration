/**
 * Domain Event: SocialMediaGenerationCreated
 * Emitted AFTER the aggregate is persisted and audit/cache completed.
 * Plain TS class — no framework dependencies.
 */
export class SocialMediaGenerationCreatedEvent {
  constructor(
    public readonly generationId: string,
    public readonly userId: string,
    public readonly topicTitle: string,
    public readonly networks: string[],
    public readonly hasImage: boolean,
    public readonly language: string,
    public readonly viralityScore: number | null,
    public readonly roiScore: number | null,
    public readonly aiDetectionScore: {
      aiGenerated: number;
      aiParaphrased: number;
      humanWritten: number;
      showsAiSigns: number;
    } | null,
    public readonly analysisReportUrl: string | null,
  ) {}
}
