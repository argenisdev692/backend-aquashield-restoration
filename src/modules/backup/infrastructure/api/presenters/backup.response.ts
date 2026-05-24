import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const BackupResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED']),
  triggeredBy: z.enum(['SCHEDULER', 'MANUAL']),
  actorId: z.string().uuid().nullable(),
  objectKey: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  checksum: z.string().nullable(),
  error: z.string().nullable(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export class BackupResponse extends createZodDto(BackupResponseSchema) {}

export const BackupListResponseSchema = z.object({
  data: z.array(BackupResponseSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

export class BackupListResponse extends createZodDto(BackupListResponseSchema) {}

export const BackupTriggeredResponseSchema = z.object({
  id: z.string().uuid(),
});

export class BackupTriggeredResponse extends createZodDto(
  BackupTriggeredResponseSchema,
) {}
