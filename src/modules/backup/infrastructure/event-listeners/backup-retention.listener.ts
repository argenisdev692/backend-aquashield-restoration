import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../../logger/logger.service';
import type { IBackupRepository } from '../../domain/ports/backup.repository.interface';
import { BACKUP_REPOSITORY } from '../../domain/ports/backup.repository.interface';
import type { IBackupStoragePort } from '../../domain/ports/backup-storage.port';
import { BACKUP_STORAGE_PORT } from '../../domain/ports/backup-storage.port';
import { BackupCompletedEvent } from '../../domain/events/backup-completed.domain-event';

const DEFAULT_KEEP = 30;

/**
 * Retention policy — keeps the newest N successful backups and prunes
 * the rest. Runs AFTER each successful backup so the window is always
 * enforced, including after a manual trigger.
 *
 * Per-row deletes (not bulk) so a single corrupt object key doesn't
 * abort the entire prune. Best-effort: failures are logged and the
 * next backup retries the prune.
 */
@Injectable()
export class BackupRetentionListener {
  private readonly keep: number;

  constructor(
    @Inject(BACKUP_REPOSITORY) private readonly repo: IBackupRepository,
    @Inject(BACKUP_STORAGE_PORT) private readonly storage: IBackupStoragePort,
    config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(BackupRetentionListener.name);
    this.keep = config.get<number>('BACKUP_RETENTION_COUNT', DEFAULT_KEEP);
  }

  @OnEvent('backup.completed')
  async handle(event: BackupCompletedEvent): Promise<void> {
    const stale = await this.repo.findCompletedBeyond(this.keep);
    if (stale.length === 0) {
      this.logger.info('BackupRetentionListener nothing to prune', {
        keep: this.keep,
        triggerBackupId: event.backupId,
      });
      return;
    }

    this.logger.info('BackupRetentionListener pruning', {
      keep: this.keep,
      pruneCount: stale.length,
      triggerBackupId: event.backupId,
    });

    for (const { id, objectKey } of stale) {
      // Storage first; if R2 succeeds and DB fails the next prune retries
      // the DB delete. If R2 fails the DB row stays so we don't lose the
      // pointer to the orphaned blob.
      await this.storage.delete(objectKey);
      try {
        await this.repo.delete(id);
      } catch (err) {
        this.logger.warn('BackupRetentionListener row delete failed', {
          backupId: id,
          objectKey,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
