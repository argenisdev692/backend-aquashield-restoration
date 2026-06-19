import { z } from 'zod';

export const UpsertRuleSchema = z.object({
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM or HH:MM:SS')
    .transform((v) => (v.length === 5 ? `${v}:00` : v)),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM or HH:MM:SS')
    .transform((v) => (v.length === 5 ? `${v}:00` : v)),
  isAvailable: z.boolean(),
}).refine((d) => d.startTime < d.endTime, {
  message: 'end_time must be after start_time',
  path: ['endTime'],
});

export type UpsertRuleDto = z.infer<typeof UpsertRuleSchema>;
