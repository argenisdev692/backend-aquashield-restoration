import { z } from 'zod';

export const CalendarQuerySchema = z.object({
  year: z.coerce.number().int().min(2024).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  // Optional: when provided, a day is also marked unavailable (reason 'full')
  // if no slot of this duration survives the ±7h appointment buffers.
  serviceDuration: z.coerce
    .number()
    .int()
    .min(15, 'Minimum service duration is 15 minutes')
    .max(480, 'Maximum service duration is 480 minutes')
    .optional(),
});

export type CalendarQueryDto = z.infer<typeof CalendarQuerySchema>;
