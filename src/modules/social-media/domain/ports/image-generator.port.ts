export const IMAGE_GENERATOR_PORT = Symbol('IImageGeneratorPort');

export interface GenerateImageInput {
  prompt: string;
  /** Optional style / aspect guidance */
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3';
}

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

export interface IImageGeneratorPort {
  generateImage(input: GenerateImageInput): Promise<GeneratedImage>;
}
