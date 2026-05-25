/**
 * Input for generating a single scene image.
 */
export interface GenerateSceneImageInput {
  niche: string;
  stage: string;
  scene: {
    title: string;
    visualDescription: string;
    imageKeywords: string[];
  };
  format: '9:16' | '16:9';
}

/**
 * Port: AI Image generator for campaign scene visuals.
 * Returns JPEG Buffer or null if generation is disabled / fails gracefully.
 *
 * In the current architecture this is typically backed by the shared IAiClient
 * (Gemini image generation). If the base AI client does not yet support image
 * generation for this use case, the adapter throws a clear NotImplemented error
 * or returns null.
 */
export interface IImageGeneratorPort {
  generate(input: GenerateSceneImageInput): Promise<Buffer | null>;

  /**
   * Whether image generation is currently available in this environment.
   */
  isEnabled(): boolean;
}

export const IMAGE_GENERATOR_PORT = Symbol('IImageGeneratorPort');
