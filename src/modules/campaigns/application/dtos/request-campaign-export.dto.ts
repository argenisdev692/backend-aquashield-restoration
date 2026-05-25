import { z } from 'zod';
import { FunnelStageSchema } from '../../domain/value-objects/funnel-stage.vo';
import { VideoFormatSchema } from '../../domain/value-objects/video-format.vo';

/**
 * Zod schema for POST /campaigns/export request body.
 *
 * IMPORTANT: businessName has been replaced by companyDataId.
 * The system will resolve the real company name from the user's CompanyData profile
 * at request time and snapshot it for the export (immutable history).
 */
export const RequestCampaignExportSchema = z.object({
  companyDataId: z.string().uuid('companyDataId must be a valid UUID'),
  niche: z.string().min(1).max(255),
  location: z.string().min(1).max(255),
  phone: z.string().min(3).max(50),
  website: z.string().url().max(2048).optional().or(z.literal('')),
  stages: z
    .array(FunnelStageSchema)
    .min(1, 'At least one funnel stage is required')
    .max(4),
  format: VideoFormatSchema,
  durationSeconds: z.union([z.literal(15), z.literal(20)]),
  language: z.string().min(2).max(10).default('es'),
  generateImages: z.boolean().default(false),
});

export type RequestCampaignExportDto = z.infer<typeof RequestCampaignExportSchema>;

/**
 * Response returned immediately after accepting an export request (202).
 */
export const CampaignExportAcceptedResponseSchema = z.object({
  generationId: z.string().uuid(),
  status: z.literal('pending'),
  message: z.string().optional(),
});

export type CampaignExportAcceptedResponse = z.infer<
  typeof CampaignExportAcceptedResponseSchema
>;
