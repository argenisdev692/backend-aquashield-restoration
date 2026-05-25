import { z } from 'zod';

/**
 * Shape for a single stage export result in API responses.
 */
export const StageExportInfoSchema = z.object({
  stage: z.string(),
  zipKey: z.string().nullable(),
  zipUrl: z.string().url().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  error: z.string().nullable(),
  hasAudio: z.boolean(),
  hasImages: z.boolean(),
});

export type StageExportInfo = z.infer<typeof StageExportInfoSchema>;

/**
 * Full status response for GET /campaigns/export/:id
 */
export const CampaignExportStatusResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  companyName: z.string(), // immutable snapshot from CompanyData at request time
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

export type CampaignExportStatusResponse = z.infer<
  typeof CampaignExportStatusResponseSchema
>;

/**
 * Item shape for list responses (GET /campaigns/exports)
 */
export const CampaignExportListItemSchema = z.object({
  id: z.string().uuid(),
  companyName: z.string(), // immutable snapshot from CompanyData at request time
  niche: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'partial']),
  stagesRequested: z.number().int(),
  stagesCompleted: z.number().int(),
  hasErrors: z.boolean(),
  createdAt: z.string().datetime(),
});

export type CampaignExportListItem = z.infer<typeof CampaignExportListItemSchema>;
