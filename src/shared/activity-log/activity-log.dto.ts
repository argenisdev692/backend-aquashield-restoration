import { z } from 'zod';

/** Read model returned by the audit query service / audit UI. */
export interface ActivityLogReadModel {
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

export const ActivityLogFilterSchema = z.object({
  actorId: z.string().uuid().optional(),
  action: z.string().max(100).optional(),
  resourceId: z.string().max(64).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ActivityLogFilter = z.infer<typeof ActivityLogFilterSchema>;

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
