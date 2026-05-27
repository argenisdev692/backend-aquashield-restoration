import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { IBackupRepository } from '../../../domain/ports/backup.repository.interface';
import { BACKUP_REPOSITORY } from '../../../domain/ports/backup.repository.interface';
import type { IBackupStoragePort } from '../../../domain/ports/backup-storage.port';
import { BACKUP_STORAGE_PORT } from '../../../domain/ports/backup-storage.port';
import { BackupNotFoundException } from '../../../domain/exceptions/backup-domain.exception';
import { DeleteBackupCommand } from '../delete-backup.command';

/**
 * Hard-deletes a backup row + its R2 object.
 *
 * Order matters:
 *   1. Tx: load → repo.delete → audit (strict). DB row is the source of
 *      truth; if step 2 partially fails we orphan a blob, not a row.
 *   2. After tx commits: best-effort storage.delete. Orphaned blobs are
 *      cleaned up by the retention listener on the next backup.
 */
@CommandHandler(DeleteBackupCommand)
export class DeleteBackupHandler implements ICommandHandler<DeleteBackupCommand> {
  private static readonly CACHE_PATTERN = 'http:*:/backups*';

  constructor(
    @Inject(BACKUP_REPOSITORY) private readonly repo: IBackupRepository,
    @Inject(BACKUP_STORAGE_PORT) private readonly storage: IBackupStoragePort,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(DeleteBackupHandler.name);
  }

  async execute(command: DeleteBackupCommand): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('DeleteBackupHandler start', {
      traceId,
      backupId: command.backupId,
      actorId: command.actorId,
    });

    const objectKey = await this.runWrite(command);

    // Side-effects MUST live outside the tx.
    await this.cache.delByPattern(DeleteBackupHandler.CACHE_PATTERN);

    if (objectKey) {
      await this.storage.delete(objectKey);
    }

    this.logger.info('DeleteBackupHandler end', {
      traceId,
      backupId: command.backupId,
    });
  }

  @Transactional()
  private async runWrite(command: DeleteBackupCommand): Promise<string | null> {
    const backup = await this.repo.findById(command.backupId);
    if (!backup) throw new BackupNotFoundException(command.backupId);

    const objectKey = backup.objectKey;
    await this.repo.delete(command.backupId);
    await this.audit.log(
      {
        action: 'backups.deleted',
        actorId: command.actorId,
        resourceType: 'DATABASE_BACKUP',
        resourceId: command.backupId,
        metadata: { objectKey },
      },
      { strict: true },
    );
    return objectKey;
  }
}
