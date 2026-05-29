import { BackupCode } from '../entities/backup-code.entity';

export interface IBackupCodeRepository {
  /**
   * Replace the entire set of backup codes for the user (used on initial
   * 2FA enable and on regenerate). The adapter deletes the prior rows and
   * inserts the new ones in a single transaction.
   */
  replaceAll(userId: string, codes: BackupCode[]): Promise<void>;

  /** Wipe all backup codes for the user (used when 2FA is disabled). */
  deleteAll(userId: string): Promise<void>;

  /**
   * All UNUSED backup codes for a user (newest first). The use-case iterates
   * with `bcrypt.compare(candidate, row.codeHash)` to find a match, then
   * calls `markUsed(id)`.
   */
  findUnusedByUserId(userId: string): Promise<BackupCode[]>;

  markUsed(id: string, now?: Date): Promise<void>;
}

export const BACKUP_CODE_REPOSITORY = Symbol('IBackupCodeRepository');
