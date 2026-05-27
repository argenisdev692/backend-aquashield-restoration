import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const GeneratePostPreviewResponseSchema = z.object({
  post_content: z.string(),
  post_title_slug: z.string(),
  post_excerpt: z.string(),
  meta_title: z.string(),
  meta_description: z.string(),
  meta_keywords: z.string(),
  generated_image_url: z.string().url().nullable(),
  sources: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
      score: z.number(),
    }),
  ),
});

export class GeneratePostPreviewResponse extends createZodDto(
  GeneratePostPreviewResponseSchema,
) {}
