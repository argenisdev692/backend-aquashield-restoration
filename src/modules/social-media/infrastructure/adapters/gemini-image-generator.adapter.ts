import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import {
  AI_CLIENT,
  type IAiClient,
} from '../../../../shared/external/ai/ai-client.port';
import type {
  IImageGeneratorPort,
  GenerateImageInput,
  GeneratedImage,
} from '../../domain/ports/image-generator.port';

@Injectable()
export class GeminiImageGeneratorAdapter implements IImageGeneratorPort {
  private readonly model: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
  ) {
    this.logger.setContext(GeminiImageGeneratorAdapter.name);
    // Use a dedicated image model. Default to a capable Gemini image-capable model.
    this.model = this.config.get<string>(
      'GEMINI_IMAGE_MODEL',
      'gemini-2.5-flash-image',
    );
  }

  async generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
    const traceId = this.cls.get<string>('traceId');

    this.logger.info('GeminiImageGeneratorAdapter.generateImage start', {
      traceId,
      model: this.model,
    });

    const prompt = this.buildPrompt(input);

    // The shared GeminiAiClient already implements generateImage using
    // responseModalities: ['TEXT', 'IMAGE'].
    const result = await this.aiClient.generateImage!({
      model: this.model,
      prompt,
    });

    this.logger.info('GeminiImageGeneratorAdapter.generateImage done', {
      traceId,
    });

    return {
      base64: result.base64,
      mimeType: result.mimeType,
    };
  }

  private buildPrompt(input: GenerateImageInput): string {
    const aspect = input.aspectRatio ?? '1:1';
    return [
      'Crea una imagen atractiva, moderna y profesional para una publicación de redes sociales.',
      `Tema: ${input.prompt}`,
      `Relación de aspecto deseada: ${aspect}.`,
      'Estilo: limpio, colores vibrantes, composición centrada, alta calidad, sin texto superpuesto.',
      'La imagen debe ser apta para Instagram, LinkedIn, Facebook y TikTok.',
    ].join('\n');
  }
}
