/**
 * IDbDumper — produces a PostgreSQL backup artifact on local disk.
 *
 * Implementations spawn `pg_dump` (or an equivalent tool) and stream the
 * output to a temp file so the upload can stream from disk with a known
 * Content-Length. The caller owns cleanup of the returned path.
 */
export interface DbDumpResult {
  /** Absolute path on the local filesystem to the produced dump file. */
  filePath: string;
  /** Total bytes written to {@link filePath}. */
  sizeBytes: number;
  /** Hex sha256 digest of the produced file — recorded for integrity audit. */
  checksum: string;
}

export interface IDbDumper {
  /**
   * @param backupId UUID used to derive the temp filename.
   * @throws if `pg_dump` exits with a non-zero status or the file write fails.
   *         The caller is responsible for removing the file in BOTH success
   *         and failure paths (use a try/finally).
   */
  dump(backupId: string): Promise<DbDumpResult>;
}

export const DB_DUMPER = Symbol('IDbDumper');
