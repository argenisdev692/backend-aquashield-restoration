import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const AvailabilityRuleResponseSchema = z.object({
  id: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
  isAvailable: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class AvailabilityRuleResponse extends createZodDto(AvailabilityRuleResponseSchema) {}
