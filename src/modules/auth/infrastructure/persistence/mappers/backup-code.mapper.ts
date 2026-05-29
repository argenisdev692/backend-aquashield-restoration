import { BackupCode } from '../../../domain/entities/backup-code.entity';

export interface BackupCodeRow {
  id: string;
  userId: string;
  codeHash: string;
  usedAt: Date | null;
  createdAt: Date;
}

export function toBackupCode(row: BackupCodeRow): BackupCode {
  return BackupCode.reconstitute({
    id: row.id,
    userId: row.userId,
    codeHash: row.codeHash,
    usedAt: row.usedAt,
    createdAt: row.createdAt,
  });
}
