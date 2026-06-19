import { z } from 'zod';

export const TimeSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  serviceDuration: z.coerce
    .number()
    .int()
    .min(15, 'Minimum service duration is 15 minutes')
    .max(480, 'Maximum service duration is 480 minutes'),
});

export type TimeSlotsQueryDto = z.infer<typeof TimeSlotsQuerySchema>;
