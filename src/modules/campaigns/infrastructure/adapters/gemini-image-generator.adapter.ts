import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { type IPolicy } from 'cockatiel';
import { createExternalServicePolicy } from '../../../../shared/external/resilience';
import { LoggerService } from '../../../../logger/logger.service';
import {
  AI_CLIENT,
  type IAiClient,
} from '../../../../shared/external/ai/ai-client.port';
import {
  IImageGeneratorPort,
  GenerateSceneImageInput,
} from '../../domain/ports/image-generator.port';

/**
 * Gemini scene-image generator. Builds an advertising prompt from the scene and
 * calls the shared AI client's image API through the circuit breaker. Returns a
 * JPEG/PNG Buffer, or null when image generation is disabled / unsupported /
 * fails — images are an optional enhancement, never a hard dependency.
 */
@Injectable()
export class GeminiCampaignImageGeneratorAdapter
  implements IImageGeneratorPort, OnModuleInit
{
  private readonly model: string;
  private readonly enabled: boolean;
  private resilience!: IPolicy;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
  ) {
    this.logger.setContext(GeminiCampaignImageGeneratorAdapter.name);
    this.model = this.config.get<string>(
      'GEMINI_IMAGE_MODEL',
      'gemini-2.0-flash-exp-image-generation',
    );
    // Disabled unless the AI client actually exposes image generation.
    this.enabled = typeof this.aiClient.generateImage === 'function';
  }

  onModuleInit(): void {
    this.resilience = createExternalServicePolicy('gemini', 'ai');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async generate(input: GenerateSceneImageInput): Promise<Buffer | null> {
    if (!this.enabled || !this.aiClient.generateImage) return null;
    const traceId = this.cls.get<string>('traceId');

    try {
      const prompt = this.buildPrompt(input);
      const result = await this.resilience.execute(() =>
        this.aiClient.generateImage!({ model: this.model, prompt }),
      );
      const buffer = Buffer.from(result.base64, 'base64');
      this.logger.info('GeminiCampaignImageGeneratorAdapter.generate done', {
        traceId,
        sceneTitle: input.scene.title,
        bytes: buffer.length,
      });
      return buffer;
    } catch (error) {
      this.logger.warn('Gemini image generation failed, skipping scene image', {
        traceId,
        sceneTitle: input.scene.title,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private buildPrompt(input: GenerateSceneImageInput): string {
    return [
      `Professional advertising photo for a ${input.niche} business.`,
      `Scene: ${input.scene.visualDescription}.`,
      `Visual keywords: ${input.scene.imageKeywords.join(', ')}.`,
      `Style: cinematic, high quality, natural lighting.`,
      `Format: ${input.format} ${input.format === '9:16' ? 'vertical' : 'horizontal'}.`,
      'NO text, NO logos, NO watermarks in the image.',
    ].join(' ');
  }
}
