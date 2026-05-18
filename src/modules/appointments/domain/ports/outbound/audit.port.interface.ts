export interface IAuditEntry {
  action: string;
  actorId?: string;
  resourceId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface IAuditPort {
  log(entry: IAuditEntry): Promise<void>;
}

export const AUDIT_PORT = Symbol('IAuditPort');
