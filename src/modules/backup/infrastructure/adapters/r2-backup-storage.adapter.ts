import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  NoSuchKey,
} from '@aws-sdk/client-s3';
import { LoggerService } from '../../../../logger/logger.service';
import type { IBackupStoragePort } from '../../domain/ports/backup-storage.port';

const DEFAULT_PREFIX = 'backups';

/**
 * Backup-dedicated R2 adapter.
 *
 * Kept distinct from `shared/storage/StorageService` so backups can be
 * pointed at a different bucket / lifecycle rule / provider without
 * touching the public file storage. Reuses the same R2 credentials by
 * default; override the bucket via `BACKUP_R2_BUCKET_NAME` for isolation.
 */
@Injectable()
export class R2BackupStorageAdapter implements IBackupStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(
    config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(R2BackupStorageAdapter.name);
    this.client = new S3Client({
      region: config.get<string>('R2_DEFAULT_REGION', 'auto'),
      endpoint: config.get<string | undefined>('R2_ENDPOINT'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
      forcePathStyle: config.get<boolean>('R2_USE_PATH_STYLE_ENDPOINT', false),
    });
    this.bucket = config.get<string>(
      'BACKUP_R2_BUCKET_NAME',
      config.getOrThrow<string>('R2_BUCKET_NAME'),
    );
    this.prefix = config.get<string>('BACKUP_R2_PREFIX', DEFAULT_PREFIX);
  }

  async uploadFromFile(params: {
    backupId: string;
    filePath: string;
    sizeBytes: number;
  }): Promise<{ objectKey: string }> {
    const objectKey = this.buildKey(params.backupId);
    this.logger.info('R2BackupStorageAdapter.uploadFromFile', {
      layer: 'adapter',
      backupId: params.backupId,
      objectKey,
      sizeBytes: params.sizeBytes,
    });
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: createReadStream(params.filePath),
        ContentLength: params.sizeBytes,
        ContentType: 'application/octet-stream',
        // Backups must NEVER be cached at the CDN edge.
        CacheControl: 'private, no-store',
      }),
    );
    return { objectKey };
  }

  async delete(objectKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      this.logger.info('R2BackupStorageAdapter.delete', {
        layer: 'adapter',
        objectKey,
      });
    } catch (err) {
      this.logger.warn('R2BackupStorageAdapter.delete failed', {
        layer: 'adapter',
        objectKey,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async download(objectKey: string): Promise<{
    body: Readable;
    contentLength: number;
  }> {
    try {
      const out = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      if (!out.Body) {
        throw new Error(`R2 returned empty body for ${objectKey}`);
      }
      return {
        body: out.Body as Readable,
        contentLength: Number(out.ContentLength ?? 0),
      };
    } catch (err) {
      if (err instanceof NoSuchKey) {
        throw new Error(`Backup object missing in storage: ${objectKey}`);
      }
      throw err;
    }
  }

  private buildKey(backupId: string): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    return `${this.prefix}/${yyyy}/${mm}/${dd}/${backupId}.dump`;
  }
}
