import { z } from 'zod';

export const CalendarQuerySchema = z.object({
  year: z.coerce.number().int().min(2024).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export type CalendarQueryDto = z.infer<typeof CalendarQuerySchema>;
