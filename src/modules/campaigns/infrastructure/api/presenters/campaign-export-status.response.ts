import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const StageExportInfoSchema = z.object({
  stage: z.string(),
  zipKey: z.string().nullable(),
  zipUrl: z.string().url().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  error: z.string().nullable(),
  hasAudio: z.boolean(),
  hasImages: z.boolean(),
});

export const CampaignExportStatusResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  companyName: z.string(),
  niche: z.string(),
  location: z.string(),
  phone: z.string(),
  website: z.string().nullable(),
  stages: z.array(z.string()),
  format: z.string(),
  durationSeconds: z.number().int(),
  language: z.string(),
  generateImages: z.boolean(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'partial']),
  errorMessage: z.string().nullable(),
  stageExports: z.array(StageExportInfoSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class CampaignExportStatusResponse extends createZodDto(
  CampaignExportStatusResponseSchema,
) {}
