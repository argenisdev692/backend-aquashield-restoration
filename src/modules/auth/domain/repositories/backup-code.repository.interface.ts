export interface BackupCodeRow {
  id: string;
  codeHash: string;
  usedAt: Date | null;
}

export interface IBackupCodeRepository {
  /** Replaces every existing code for the user with the given fresh hashes. */
  replaceAllForUser(userId: string, codeHashes: string[]): Promise<void>;
  /** Returns unused codes (used ones are filtered out). */
  findUnusedByUserId(userId: string): Promise<BackupCodeRow[]>;
  markUsed(id: string): Promise<void>;
  /** Wipes every backup code for the user. Used by disable-2FA. */
  deleteAllForUser(userId: string): Promise<void>;
  countUnusedByUserId(userId: string): Promise<number>;
}

export const BACKUP_CODE_REPOSITORY = Symbol('IBackupCodeRepository');
