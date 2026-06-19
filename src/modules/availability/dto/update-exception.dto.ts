import { z } from 'zod';

export const UpdateExceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  isAvailable: z.boolean().optional(),
  reason: z.string().max(255).nullable().optional(),
});

export type UpdateExceptionDto = z.infer<typeof UpdateExceptionSchema>;
