import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IImageGeneratorPort, GenerateSceneImageInput } from '../../../domain/ports/image-generator.port';
import { LoggerService } from '../../../../../logger/logger.service';

/**
 * STUB Gemini scene image generator.
 *
 * Real implementation will:
 * - Check if Gemini image generation is available on the shared IAiClient
 * - Build a high-quality advertising prompt from the scene
 * - Call the image generation method and return JPEG Buffer
 * - Apply cockatiel resilience
 *
 * This stub returns null (no image) when disabled, or a 1x1 transparent PNG when "enabled".
 */
@Injectable()
export class StubImageGeneratorAdapter implements IImageGeneratorPort {
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(StubImageGeneratorAdapter.name);
    // In real code we would also check if the underlying AI client supports image gen
    this.enabled = this.config.get<boolean>('CAMPAIGN_IMAGES_ENABLED', false);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async generate(input: GenerateSceneImageInput): Promise<Buffer | null> {
    if (!this.enabled) {
      return null;
    }

    // Minimal valid 1x1 transparent PNG (stub)
    const fakePng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64',
    );

    this.logger.debug('StubImageGeneratorAdapter.generate (stub)', {
      sceneId: input.scene.title,
      niche: input.niche,
    });

    return fakePng;
  }
}
