export interface IAuditEntry {
  action: string;
  actorId?: string;
  resourceId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface IAuditLogOptions {
  /**
   * When true a failure to persist the audit row is re-thrown so the caller
   * (typically a `@Transactional()` boundary) can roll back the surrounding
   * write. Defaults to false (legacy fire-and-forget behavior).
   */
  strict?: boolean;
}

export interface IAuditPort {
  log(entry: IAuditEntry, options?: IAuditLogOptions): Promise<void>;
}

export const AUDIT_PORT = Symbol('IAuditPort');
