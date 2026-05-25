import { Injectable, BadRequestException } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';
import Sharp from 'sharp';

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  format: 'webp';
}

@Injectable()
export class ImageProcessorService {
  private readonly loggerContext = 'ImageProcessorService';

  private static readonly ALLOWED_MIME = /^(image\/jpeg|image\/png|image\/webp)$/;
  private static readonly MAX_INPUT_BYTES = 5 * 1024 * 1024;
  private static readonly MAX_DIMENSION = 1024;
  private static readonly WEBP_QUALITY = 86;

  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(this.loggerContext);
  }

  private hasSafeImageSignature(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 12) return false;

    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;

    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    )
      return true;

    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    )
      return true;

    return false;
  }

  async processForProfilePhoto(
    input: { buffer: Buffer; mimeType: string },
  ): Promise<ProcessedImage> {
    if (!ImageProcessorService.ALLOWED_MIME.test(input.mimeType)) {
      throw new BadRequestException('Unsupported image type. Allowed: JPEG, PNG, WebP.');
    }

    if (input.buffer.length > ImageProcessorService.MAX_INPUT_BYTES) {
      throw new BadRequestException('Image too large. Maximum 5MB before processing.');
    }

    if (!this.hasSafeImageSignature(input.buffer)) {
      throw new BadRequestException('Invalid or corrupted image file (magic byte check failed).');
    }

    try {
      const pipeline = Sharp(input.buffer, {
        failOn: 'error',
        limitInputPixels: 4096 * 4096,
      })
        .rotate()
        .resize({
          width: ImageProcessorService.MAX_DIMENSION,
          height: ImageProcessorService.MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: ImageProcessorService.WEBP_QUALITY,
          effort: 4,
        });

      const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

      return {
        buffer: data,
        mimeType: 'image/webp',
        width: info.width,
        height: info.height,
        format: 'webp',
      };
    } catch (err) {
      this.logger.error('Sharp processing failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw new BadRequestException('Failed to process image. The file may be corrupted or unsupported.');
    }
  }
}
