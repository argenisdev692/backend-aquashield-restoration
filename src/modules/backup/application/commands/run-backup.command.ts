import type { BackupTrigger } from '../../domain/value-objects/backup-status.vo';

/**
 * Dispatched by:
 * - {@link import('../../infrastructure/jobs/backup.scheduler').BackupScheduler}
 *   on the daily cron (`triggeredBy = SCHEDULER`, `actorId = null`).
 * - {@link import('../../infrastructure/api/controllers/backup.controller').BackupController#trigger}
 *   when an admin POSTs `/backups/run` (`triggeredBy = MANUAL`, `actorId = jwt.id`).
 */
export class RunBackupCommand {
  constructor(
    public readonly triggeredBy: BackupTrigger,
    public readonly actorId: string | null,
  ) {}
}
