import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ActivityLogResponseSchema = z.object({
  id: z.string().uuid(),
  action: z.string(),
  actorId: z.string().uuid().nullable(),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  traceId: z.string().nullable(),
  correlationId: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});

export class ActivityLogResponse extends createZodDto(
  ActivityLogResponseSchema,
) {}
