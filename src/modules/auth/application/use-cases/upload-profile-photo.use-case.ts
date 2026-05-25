import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { USER_AUTH_REPOSITORY } from '../../domain/repositories/user-auth.repository.interface';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { ITransactionManager } from '../../../../shared/database/transaction-manager.port';
import { TRANSACTION_MANAGER } from '../../../../shared/database/transaction-manager.port';
import { StorageService } from '../../../../shared/storage/storage.service';
import { CacheService } from '../../../../shared/cache/cache.service';
import {
  ImageProcessorService,
  type ProcessedImage,
} from '../../../../shared/image/image-processor.service';

export interface UploadProfilePhotoInput {
  buffer: Buffer;
  mimeType: string;
}

export interface UploadProfilePhotoResult {
  profilePhotoPath: string;
}

@Injectable()
export class UploadProfilePhotoUseCase {
  private readonly directory = 'profile-photos';

  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userRepo: IUserAuthRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER)
    private readonly tx: ITransactionManager,
    private readonly storage: StorageService,
    private readonly cache: CacheService,
    private readonly imageProcessor: ImageProcessorService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(UploadProfilePhotoUseCase.name);
  }

  async execute(
    userId: string,
    input: UploadProfilePhotoInput,
  ): Promise<UploadProfilePhotoResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('UploadProfilePhoto start', { traceId, userId });

    const profile = await this.userRepo.findProfileById(userId);
    if (!profile) {
      throw new NotFoundException('User not found');
    }

    const processed: ProcessedImage =
      await this.imageProcessor.processForProfilePhoto(input);

    const key = `${this.directory}/${userId}/avatar.webp`;
    const publicUrl = this.storage.publicUrl(key);

    await this.storage.upload(key, processed.buffer, processed.mimeType);

    let result: UploadProfilePhotoResult;
    try {
      result = await this.tx.runInTx(async () => {
        await this.userRepo.updateProfilePhoto(userId, publicUrl);

        await this.audit.log(
          {
            action: 'auth.profile_photo_uploaded',
            resourceType: 'USER',
            resourceId: userId,
            metadata: {
              width: processed.width,
              height: processed.height,
              format: processed.format,
            },
          },
          { strict: true },
        );

        return { profilePhotoPath: publicUrl };
      });
    } catch (error) {
      await this.safeDelete(key);
      this.logger.warn('UploadProfilePhoto tx failed, cleaned up new blob', {
        traceId,
        userId,
        key,
      });
      throw error;
    }

    if (profile.profilePhotoPath) {
      try {
        const oldKey = this.storage.keyFromUrl(profile.profilePhotoPath);
        if (oldKey !== key) {
          await this.safeDelete(oldKey);
        }
      } catch (cleanupErr) {
        this.logger.warn('Failed to delete previous profile photo (non-fatal)', {
          traceId,
          userId,
          error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        });
      }
    }

    await this.cache.delByPattern(`http:${userId}:/auth/me*`);

    this.logger.info('UploadProfilePhoto end', { traceId, userId });
    return result;
  }

  private async safeDelete(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (err) {
      const traceId = this.cls.get<string>('traceId');
      this.logger.warn('Storage delete failed (best-effort)', {
        traceId,
        key,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
