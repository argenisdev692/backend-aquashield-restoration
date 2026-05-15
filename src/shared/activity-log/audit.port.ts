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

export interface IAuditPort {
  log(entry: IAuditEntry): Promise<void>;
}

export const AUDIT_PORT = Symbol('IAuditPort');
