import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IBackupRepository } from '../../../domain/ports/backup.repository.interface';
import { BACKUP_REPOSITORY } from '../../../domain/ports/backup.repository.interface';
import type { IDbDumper } from '../../../domain/ports/db-dumper.port';
import { DB_DUMPER } from '../../../domain/ports/db-dumper.port';
import type { IBackupStoragePort } from '../../../domain/ports/backup-storage.port';
import { BACKUP_STORAGE_PORT } from '../../../domain/ports/backup-storage.port';
import { Backup } from '../../../domain/entities/backup.aggregate';
import { BackupId } from '../../../domain/value-objects/backup-id.vo';
import { BackupNotFoundException } from '../../../domain/exceptions/backup-domain.exception';
import {
  BackupCompletedEvent,
  BackupFailedEvent,
} from '../../../domain/events/backup-completed.domain-event';
import { RunBackupCommand } from '../run-backup.command';

/**
 * Three-stage backup flow:
 *   1. Persist PENDING row (fast tx). Audit `backups.triggered`.
 *   2. Outside any tx: pg_dump → temp file → upload to R2.
 *   3. Tx to mark COMPLETED (or FAILED on any failure in stage 2). Audit
 *      `backups.completed` / `backups.failed` strict so the audit row
 *      commits atomically with the status flip.
 *
 * The aggregate cannot live across stages 1 → 2 → 3 (the work between
 * stages takes minutes and CANNOT hold a Postgres tx open). The row is
 * the durable source of truth; the aggregate is re-hydrated for stage 3.
 */
@CommandHandler(RunBackupCommand)
export class RunBackupHandler implements ICommandHandler<RunBackupCommand> {
  constructor(
    @Inject(BACKUP_REPOSITORY) private readonly repo: IBackupRepository,
    @Inject(DB_DUMPER) private readonly dumper: IDbDumper,
    @Inject(BACKUP_STORAGE_PORT) private readonly storage: IBackupStoragePort,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly events: EventEmitter2,
  ) {
    this.logger.setContext(RunBackupHandler.name);
  }

  async execute(command: RunBackupCommand): Promise<string> {
    const traceId = this.cls.get<string>('traceId');
    const backupId = randomUUID();
    this.logger.info('RunBackupHandler start', {
      traceId,
      backupId,
      triggeredBy: command.triggeredBy,
    });

    // Stage 1 — persist PENDING + trigger audit.
    await this.insertPending(backupId, command);

    // Stage 2 — heavy work OUTSIDE the tx. Errors here flip the row to FAILED.
    let dumpFilePath: string | null = null;
    try {
      const dump = await this.dumper.dump(backupId);
      dumpFilePath = dump.filePath;
      const upload = await this.storage.uploadFromFile({
        backupId,
        filePath: dump.filePath,
        sizeBytes: dump.sizeBytes,
      });

      // Stage 3 (success) — flip to COMPLETED + audit + emit.
      await this.markCompleted({
        backupId,
        objectKey: upload.objectKey,
        sizeBytes: dump.sizeBytes,
        checksum: dump.checksum,
      });

      this.events.emit(
        'backup.completed',
        new BackupCompletedEvent(backupId, upload.objectKey, dump.sizeBytes),
      );
      this.logger.info('RunBackupHandler end', {
        traceId,
        backupId,
        sizeBytes: dump.sizeBytes,
      });
      return backupId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('RunBackupHandler failed', {
        traceId,
        backupId,
        error: message,
      });

      // Stage 3 (failure) — flip to FAILED + audit + emit. Best-effort: if
      // even this fails the row stays PENDING and is visible in the list
      // for manual cleanup.
      try {
        await this.markFailed({ backupId, error: message });
        this.events.emit('backup.failed', new BackupFailedEvent(backupId, message));
      } catch (flipErr) {
        this.logger.error('RunBackupHandler markFailed also failed', {
          traceId,
          backupId,
          error: flipErr instanceof Error ? flipErr.message : String(flipErr),
        });
      }
      throw err;
    } finally {
      // Always remove the temp file — disk pressure is a real failure mode
      // for a daily-running job.
      if (dumpFilePath) {
        await fs.unlink(dumpFilePath).catch((unlinkErr: unknown) => {
          this.logger.warn('RunBackupHandler temp file cleanup failed', {
            traceId,
            backupId,
            path: dumpFilePath,
            error:
              unlinkErr instanceof Error ? unlinkErr.message : String(unlinkErr),
          });
        });
      }
    }
  }

  @Transactional()
  private async insertPending(
    backupId: string,
    command: RunBackupCommand,
  ): Promise<void> {
    const backup = Backup.createPending({
      id: BackupId.reconstitute(backupId),
      triggeredBy: command.triggeredBy,
      actorId: command.actorId,
    });
    await this.repo.create(backup);
    await this.audit.log(
      {
        action: 'backups.triggered',
        actorId: command.actorId ?? undefined,
        resourceType: 'DATABASE_BACKUP',
        resourceId: backupId,
        metadata: { triggeredBy: command.triggeredBy },
      },
      { strict: true },
    );
  }

  @Transactional()
  private async markCompleted(params: {
    backupId: string;
    objectKey: string;
    sizeBytes: number;
    checksum: string;
  }): Promise<void> {
    const backup = await this.repo.findById(params.backupId);
    if (!backup) throw new BackupNotFoundException(params.backupId);
    backup.markCompleted({
      objectKey: params.objectKey,
      sizeBytes: params.sizeBytes,
      checksum: params.checksum,
    });
    await this.repo.save(backup);
    await this.audit.log(
      {
        action: 'backups.completed',
        actorId: backup.actorId ?? undefined,
        resourceType: 'DATABASE_BACKUP',
        resourceId: params.backupId,
        metadata: {
          objectKey: params.objectKey,
          sizeBytes: params.sizeBytes,
          checksum: params.checksum,
        },
      },
      { strict: true },
    );
  }

  @Transactional()
  private async markFailed(params: {
    backupId: string;
    error: string;
  }): Promise<void> {
    const backup = await this.repo.findById(params.backupId);
    if (!backup) throw new BackupNotFoundException(params.backupId);
    backup.markFailed({ error: params.error });
    await this.repo.save(backup);
    await this.audit.log(
      {
        action: 'backups.failed',
        actorId: backup.actorId ?? undefined,
        resourceType: 'DATABASE_BACKUP',
        resourceId: params.backupId,
        metadata: { error: params.error },
      },
      { strict: true },
    );
  }
}
