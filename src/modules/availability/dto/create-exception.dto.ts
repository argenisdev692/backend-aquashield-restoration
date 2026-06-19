import { z } from 'zod';

export const CreateExceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  isAvailable: z.boolean(),
  reason: z.string().max(255).optional(),
});

export type CreateExceptionDto = z.infer<typeof CreateExceptionSchema>;
