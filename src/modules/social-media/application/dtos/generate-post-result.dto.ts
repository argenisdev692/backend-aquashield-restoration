import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const GeneratePostJobResultSchema = z.object({
  jobId: z.string(),
  status: z.literal('queued'),
});

export class GeneratePostJobResultDto extends createZodDto(
  GeneratePostJobResultSchema,
) {}

export type GeneratePostJobResult = z.infer<typeof GeneratePostJobResultSchema>;
