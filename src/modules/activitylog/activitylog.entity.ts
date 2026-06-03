export interface ActivityLog {
  id: string;
  action: string;
  actorId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  traceId: string | null;
  correlationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
