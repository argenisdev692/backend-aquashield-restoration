import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ExportSocialMediaSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
  niche: z.string().max(120).optional(),
  language: z.string().max(10).optional(),
  network: z.enum(['facebook', 'instagram', 'tiktok', 'linkedin']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export class ExportSocialMediaDto extends createZodDto(ExportSocialMediaSchema) {}

export type ExportSocialMediaInput = z.infer<typeof ExportSocialMediaSchema>;
