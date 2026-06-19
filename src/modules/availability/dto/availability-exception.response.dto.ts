import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const AvailabilityExceptionResponseSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isAvailable: z.boolean(),
  reason: z.string().nullable(),
  status: z.enum(['active', 'suspended']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});

export class AvailabilityExceptionResponse extends createZodDto(
  AvailabilityExceptionResponseSchema,
) {}

export const PaginatedExceptionResponseSchema = z.object({
  data: z.array(AvailabilityExceptionResponseSchema),
  total: z.number().int(),
});

export class PaginatedExceptionResponse extends createZodDto(PaginatedExceptionResponseSchema) {}
