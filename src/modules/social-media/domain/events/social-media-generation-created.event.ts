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
  ) {}
}
