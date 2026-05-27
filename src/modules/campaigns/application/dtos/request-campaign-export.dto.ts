import { z } from 'zod';
import { FunnelStageSchema } from '../../domain/value-objects/funnel-stage.vo';
import { VideoFormatSchema } from '../../domain/value-objects/video-format.vo';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  city: z.string().max(255).optional(),
  state: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
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
  aiObservations: z
    .string()
    .max(400, 'aiObservations must be at most 400 characters')
    .optional(),
});

export type RequestCampaignExportDto = z.infer<
  typeof RequestCampaignExportSchema
>;

/**
 * Swagger DTO for POST /campaigns/export request body.
 * Used for OpenAPI documentation generation.
 */
export class RequestCampaignExportBody {
  @ApiProperty({
    description: 'Company data ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  companyDataId!: string;

  @ApiProperty({
    description: 'Business niche',
    example: 'Restoration Services',
  })
  niche!: string;

  @ApiProperty({ description: 'Location', example: 'Miami, FL' })
  location!: string;

  @ApiPropertyOptional({ description: 'City', example: 'Miami' })
  city?: string;

  @ApiPropertyOptional({ description: 'State', example: 'FL' })
  state?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'USA' })
  country?: string;

  @ApiProperty({ description: 'Phone number', example: '+1-305-555-0123' })
  phone!: string;

  @ApiPropertyOptional({
    description: 'Website URL',
    example: 'https://example.com',
  })
  website?: string;

  @ApiProperty({
    description: 'Funnel stages (TOFU/MOFU/BOFU/LOYALTY)',
    type: [String],
    enum: ['TOFU', 'MOFU', 'BOFU', 'LOYALTY'],
    example: ['TOFU', 'MOFU', 'BOFU'],
  })
  stages!: string[];

  @ApiProperty({
    description: 'Video format',
    enum: ['mp4', 'webm'],
    example: 'mp4',
  })
  format!: string;

  @ApiProperty({
    description: 'Video duration in seconds',
    enum: [15, 20],
    example: 15,
  })
  durationSeconds!: number;

  @ApiProperty({ description: 'Language code', example: 'es', default: 'es' })
  language!: string;

  @ApiProperty({
    description: 'Generate images',
    example: false,
    default: false,
  })
  generateImages!: boolean;

  @ApiPropertyOptional({
    description: 'AI observations (max 400 characters)',
    example: 'Focus on water damage restoration',
    maxLength: 400,
  })
  aiObservations?: string;
}

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
