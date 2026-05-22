/**
 * IAuditPort — business audit contract.
 *
 * Called manually in every write path that mutates state (write use case in
 * Hex/DDD; mutation method in CRUD services that opt into audit). Read/export
 * use cases MUST NOT call it.
 */
export interface IAuditEntry {
  /** `{module}.{past_tense_verb}` — e.g. `users.created`, `auth.login`. */
  action: string;
  /** Actor user id, or omitted/undefined for system actions. */
  actorId?: string;
  /** Logical resource type, e.g. `USER`, `APPOINTMENT`. */
  resourceType?: string;
  /** Affected resource id (route param, never request body). */
  resourceId?: string;
  /** Extra non-sensitive context. Sensitive keys are stripped before write. */
  metadata?: Record<string, unknown>;
}

export interface IAuditLogOptions {
  /**
   * When true, a failure to persist the audit row is re-thrown so the caller
   * (typically `runInTx`) can roll back the surrounding business mutation.
   *
   * When false (default), the failure is logged at ERROR level and swallowed
   * — the business path must never break because audit infrastructure failed.
   *
   * Pick `strict: true` whenever the audit row and the mutated entity must
   * commit together (most CRUD write paths). Pick the default for fire-and-
   * forget audit on read/login/etc. that should never abort the user flow.
   */
  strict?: boolean;
}

export interface IAuditPort {
  log(entry: IAuditEntry, options?: IAuditLogOptions): Promise<void>;
}

export const AUDIT_PORT = Symbol('IAuditPort');
