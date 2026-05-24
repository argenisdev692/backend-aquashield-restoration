import type { Readable } from 'node:stream';

/**
 * IBackupStoragePort — durable storage for backup artifacts.
 *
 * Distinct from the public `StorageService` so backups can later be moved
 * to a different bucket / prefix / provider without touching application
 * code. The adapter currently shells out to the existing R2 client.
 */
export interface IBackupStoragePort {
  /** Upload a local file. Returns the object key written. */
  uploadFromFile(params: {
    backupId: string;
    filePath: string;
    sizeBytes: number;
  }): Promise<{ objectKey: string }>;

  /** Best-effort delete. Logs and swallows — caller must not depend on success. */
  delete(objectKey: string): Promise<void>;

  /** Streams the object back for download. Throws if the object is missing. */
  download(objectKey: string): Promise<{
    body: Readable;
    contentLength: number;
  }>;
}

export const BACKUP_STORAGE_PORT = Symbol('IBackupStoragePort');
