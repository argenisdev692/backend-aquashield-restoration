// CQRS justification (per backend-nest.md "CommandBus/QueryBus requires
// explicit per-context decision"): the backup bounded context owns a
// multi-stage workflow (PENDING insert → pg_dump → R2 upload → terminal
// status), emits domain events (`backup.completed` / `backup.failed`),
// and has a retention listener — all upgrade triggers from
// ARCHITECTURE-NEST-CRUD. Splitting writes into CommandHandlers and
// reads into QueryHandlers keeps the scheduled job, the manual trigger,
// and the read paths independently testable. Other modules without
// these triggers must default to flat CRUD.
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { BackupController } from './infrastructure/api/controllers/backup.controller';

import { RunBackupHandler } from './application/commands/handlers/run-backup.handler';
import { DeleteBackupHandler } from './application/commands/handlers/delete-backup.handler';
import { GetBackupByIdHandler } from './application/queries/handlers/get-backup-by-id.handler';
import { GetBackupsListHandler } from './application/queries/handlers/get-backups-list.handler';
import { GetBackupDownloadHandler } from './application/queries/handlers/get-backup-download.handler';

import { PrismaBackupRepository } from './infrastructure/persistence/repositories/prisma-backup.repository';
import { PgDumpAdapter } from './infrastructure/adapters/pg-dump.adapter';
import { R2BackupStorageAdapter } from './infrastructure/adapters/r2-backup-storage.adapter';
import { BackupScheduler } from './infrastructure/jobs/backup.scheduler';
import { BackupRetentionListener } from './infrastructure/event-listeners/backup-retention.listener';
import { BackupFailedListener } from './infrastructure/event-listeners/backup-failed.listener';

import { BACKUP_REPOSITORY } from './domain/ports/backup.repository.interface';
import { DB_DUMPER } from './domain/ports/db-dumper.port';
import { BACKUP_STORAGE_PORT } from './domain/ports/backup-storage.port';

@Module({
  imports: [CqrsModule, EventEmitterModule],
  controllers: [BackupController],
  providers: [
    RunBackupHandler,
    DeleteBackupHandler,
    GetBackupByIdHandler,
    GetBackupsListHandler,
    GetBackupDownloadHandler,

    PrismaBackupRepository,
    PgDumpAdapter,
    R2BackupStorageAdapter,
    BackupScheduler,
    BackupRetentionListener,
    BackupFailedListener,

    { provide: BACKUP_REPOSITORY, useExisting: PrismaBackupRepository },
    { provide: DB_DUMPER, useExisting: PgDumpAdapter },
    { provide: BACKUP_STORAGE_PORT, useExisting: R2BackupStorageAdapter },
  ],
})
export class BackupModule {}
