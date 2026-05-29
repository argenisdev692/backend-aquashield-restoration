import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../logger/logger.service';
import { CLS_KEYS } from '../../../../shared/cls/cls.constants';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../../shared/activity-log/audit.port';
import {
  STORAGE_PORT,
  type IStoragePort,
} from '../../../../shared/storage/storage.port';
import { ImageProcessorService } from '../../../../shared/image/image-processor.service';
import { UserAccountNotFoundException } from '../../domain/exceptions/auth-domain.exception';

export interface UploadResult {
  profilePhotoUrl: string;
  profilePhotoPath: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Self-service profile-photo upload. Follows the canonical R2 + DB
 * compound-write pattern from CLAUDE.md:
 *   1. Sharp validates + resizes + re-encodes the input (only valid PNG/
 *      JPEG/WebP signatures pass — strips EXIF, no SVG, no path traversal).
 *   2. Upload the new blob FIRST (CB-wrapped IStoragePort).
 *   3. Run the DB tx that updates `users.profilePhotoPath` + audit.
 *   4. On tx failure → best-effort delete the freshly-uploaded blob.
 *   5. After the tx commits → best-effort delete the OLD blob.
 *
 * Email-bomb / DoS guard: file size is hard-capped at 5MB upstream
 * (ImageProcessorService.MAX_INPUT_BYTES). Multer/throttler is expected
 * to enforce the upload size budget at the controller boundary.
 *
 * Circuit breaker: lives inside `IStoragePort` (the
 * `CircuitBreakerStorageAdapter` wraps every upload/delete with cockatiel)
 * so a Cloudflare R2 outage cannot pin a request — it fails fast and the
 * controller surfaces 503.
 */
@Injectable()
export class UploadProfilePhotoUseCase {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: IStoragePort,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly images: ImageProcessorService,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(UploadProfilePhotoUseCase.name);
  }

  async execute(args: {
    userId: string;
    file: { buffer: Buffer; mimetype: string };
  }): Promise<UploadResult> {
    // 1. Validate + resize + re-encode to webp.
    const processed = await this.images.processForProfilePhoto({
      buffer: args.file.buffer,
      mimeType: args.file.mimetype,
    });

    // 2. Upload BEFORE the tx — failure here is recoverable (we never
    //    touched the DB). Random suffix avoids any path-collision and
    //    serves as a cache-buster on the public URL.
    const key = this.buildKey(args.userId);
    await this.storage.upload(key, processed.buffer, processed.mimeType);

    // 3. DB tx + audit; on failure clean up the blob we just wrote.
    let oldKey: string | null = null;
    try {
      oldKey = await this.commit(args.userId, key);
    } catch (err) {
      await this.tryDelete(key);
      throw err;
    }

    // 4. Best-effort: drop the previous blob now that the tx committed.
    if (oldKey && oldKey !== key) {
      await this.tryDelete(oldKey);
    }

    const url = this.storage.publicUrl(key);
    this.logger.info('Profile photo uploaded', {
      traceId: this.cls.get<string>(CLS_KEYS.TRACE_ID),
      userId: args.userId,
      key,
      width: processed.width,
      height: processed.height,
      sizeBytes: processed.buffer.length,
    });

    return {
      profilePhotoUrl: url,
      profilePhotoPath: key,
      width: processed.width,
      height: processed.height,
      sizeBytes: processed.buffer.length,
    };
  }

  @Transactional()
  private async commit(userId: string, newKey: string): Promise<string | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profilePhotoPath: true },
    });
    if (!row) throw new UserAccountNotFoundException();

    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePhotoPath: newKey },
    });

    await this.audit.log(
      {
        action: 'auth.profile_photo.updated',
        actorId: userId,
        resourceType: 'USER',
        resourceId: userId,
        metadata: {
          newKey,
          replaced: !!row.profilePhotoPath,
          ipAddress: this.cls.get<string>(CLS_KEYS.IP_ADDRESS) ?? null,
        },
      },
      { strict: true },
    );

    return row.profilePhotoPath;
  }

  private buildKey(userId: string): string {
    // `users/{id}/profile/{random}.webp` — predictable enough for cache
    // policies, random enough to bust browser cache on each update.
    const random = randomBytes(8).toString('hex');
    return `users/${userId}/profile/${random}.webp`;
  }

  private async tryDelete(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (err) {
      this.logger.warn('Best-effort blob delete failed', {
        key,
        error: (err as Error).message,
      });
    }
  }
}
