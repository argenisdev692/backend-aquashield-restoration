import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const FindTopicsSchema = z.object({
  niche: z.string().min(2).max(120),
  language: z.string().min(2).max(10).optional().default('es'),
  maxTopics: z.number().int().min(3).max(15).optional().default(8),
});

export class FindTopicsDto extends createZodDto(FindTopicsSchema) {}

export type FindTopicsInput = z.infer<typeof FindTopicsSchema>;
