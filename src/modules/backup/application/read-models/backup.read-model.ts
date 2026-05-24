import type { BackupStatus, BackupTrigger } from '../../domain/value-objects/backup-status.vo';

export interface BackupReadModel {
  id: string;
  status: BackupStatus;
  triggeredBy: BackupTrigger;
  actorId: string | null;
  objectKey: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  error: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}
