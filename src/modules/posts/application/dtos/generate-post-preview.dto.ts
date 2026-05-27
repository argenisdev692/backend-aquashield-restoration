import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const GeneratePostPreviewSchema = z.object({
  topic: z
    .string()
    .min(3)
    .max(255)
    .describe(
      'Main topic or title idea for the post. This becomes the seed for AI generation (E-E-A-T + SEO). Example: "Cómo optimizar el rendimiento de React en 2026"',
    ),
  niche: z
    .string()
    .min(2)
    .max(100)
    .describe(
      'Industry or vertical the content belongs to. Used to tailor tone, examples, and E-E-A-T grounding. Example: "Desarrollo Web" or "Fintech"',
    ),
  wordCount: z.coerce
    .number()
    .int()
    .min(300)
    .max(5000)
    .default(1200)
    .describe(
      'Approximate target word count for the generated article body (300-5000). The AI will aim for this length while respecting SEO structure and E-E-A-T rules.',
    ),
});

export class GeneratePostPreviewDto extends createZodDto(
  GeneratePostPreviewSchema,
) {}

export type GeneratePostPreviewInput = z.infer<
  typeof GeneratePostPreviewSchema
>;
