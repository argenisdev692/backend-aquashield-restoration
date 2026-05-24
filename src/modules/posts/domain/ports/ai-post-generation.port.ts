import { GeneratedPostPreview } from '../value-objects/generated-post-preview.vo';

export const AI_POST_GENERATION_PORT = Symbol('AiPostGenerationPort');

export interface AiPostGenerationPort {
  generatePreview(
    topic: string,
    niche: string,
    wordCount: number,
  ): Promise<GeneratedPostPreview>;
}
