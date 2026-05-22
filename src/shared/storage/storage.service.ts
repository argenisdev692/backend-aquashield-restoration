import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { LoggerService } from '../../logger/logger.service';

/**
 * Thin wrapper around Cloudflare R2 (S3-compatible).
 *
 * Owns the S3Client lifecycle. All modules that need file storage inject this
 * service — never instantiate S3Client directly in feature modules.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly baseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(StorageService.name);
    this.client = new S3Client({
      region: config.get<string>('R2_DEFAULT_REGION', 'auto'),
      endpoint: config.get<string | undefined>('R2_ENDPOINT'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
      forcePathStyle: config.get<boolean>('R2_USE_PATH_STYLE_ENDPOINT', false),
    });
    this.bucket = config.getOrThrow<string>('R2_BUCKET_NAME');
    this.baseUrl = config
      .getOrThrow<string>('R2_PUBLIC_BASE_URL')
      .replace(/\/$/, '');
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    this.logger.info('StorageService.upload', { key, contentType });
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async delete(key: string): Promise<void> {
    this.logger.info('StorageService.delete', { key });
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  /** Returns the public URL for a stored object key. */
  publicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  /**
   * Extracts the object key from a full public URL produced by `publicUrl()`.
   * Throws if the URL does not belong to the configured bucket base URL so the
   * caller's try-catch can log it rather than silently passing a garbage key
   * to the S3 delete command.
   */
  keyFromUrl(url: string): string {
    const prefix = `${this.baseUrl}/`;
    if (!url.startsWith(prefix)) {
      throw new Error(`URL does not belong to this storage bucket: ${url}`);
    }
    return url.slice(prefix.length);
  }
}
