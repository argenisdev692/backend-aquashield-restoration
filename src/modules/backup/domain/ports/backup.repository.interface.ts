import type { Backup } from '../entities/backup.aggregate';
import type { BackupReadModel } from '../read-models/backup.read-model';

export interface BackupListFilters {
  page: number;
  limit: number;
}

export interface PaginatedBackups {
  data: BackupReadModel[];
  total: number;
  page: number;
  limit: number;
}

export interface IBackupRepository {
  create(backup: Backup): Promise<void>;
  save(backup: Backup): Promise<void>;
  findById(id: string): Promise<Backup | null>;
  /** Read-model variant — skips aggregate hydration. */
  findReadModelById(id: string): Promise<BackupReadModel | null>;
  findAll(filters: BackupListFilters): Promise<PaginatedBackups>;
  /**
   * Unbounded read of the table for an export. Caps the result at
   * `maxRows` so a runaway table cannot exhaust memory while building
   * the spreadsheet/PDF.
   */
  findAllForExport(maxRows: number): Promise<BackupReadModel[]>;
  /**
   * Returns the ids + objectKeys of COMPLETED backups beyond the `keep`
   * newest, ordered oldest first. Used by the retention listener to prune.
   */
  findCompletedBeyond(keep: number): Promise<
    Array<{ id: string; objectKey: string }>
  >;
  /** Hard delete — row is unrecoverable. */
  delete(id: string): Promise<void>;
}

export const BACKUP_REPOSITORY = Symbol('IBackupRepository');
