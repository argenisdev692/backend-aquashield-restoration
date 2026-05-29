import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import { FunnelStageSchema } from '../../domain/value-objects/funnel-stage.vo';
import { VideoFormatSchema } from '../../domain/value-objects/video-format.vo';

/**
 * Zod schema for POST /campaigns/generate-campaign request body.
 * Step 2 of the 2-step campaign generation process.
 */
export const GenerateCampaignSchema = z.object({
  companyDataId: z.string().uuid('companyDataId must be a valid UUID'),
  topicId: z.string(),
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
  aiProvider: z.enum(['gemini', 'claude', 'openai']).default('gemini'),
});

export type GenerateCampaignDto = z.infer<typeof GenerateCampaignSchema>;

/**
 * Swagger DTO for POST /campaigns/generate-campaign request body.
 */
export class GenerateCampaignBody {
  @ApiProperty({
    description: 'Company data ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  companyDataId!: string;

  @ApiProperty({
    description: 'Selected topic ID from generate-topics response',
    example: 'topic-1',
  })
  topicId!: string;

  @ApiProperty({
    description: 'Business niche',
    example: 'Restoration Services',
  })
  niche!: string;

  @ApiProperty({ description: 'Location', example: 'Miami, FL' })
  location!: string;

  @ApiProperty({ description: 'City', example: 'Miami', required: false })
  city?: string;

  @ApiProperty({ description: 'State', example: 'FL', required: false })
  state?: string;

  @ApiProperty({ description: 'Country', example: 'USA', required: false })
  country?: string;

  @ApiProperty({ description: 'Phone number', example: '+1-305-555-0123' })
  phone!: string;

  @ApiProperty({
    description: 'Website URL',
    example: 'https://example.com',
    required: false,
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
    description: 'Video aspect ratio',
    enum: ['9:16', '16:9', 'both'],
    example: '9:16',
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

  @ApiProperty({
    description: 'AI observations (max 400 characters)',
    example: 'Focus on water damage restoration',
    maxLength: 400,
    required: false,
  })
  aiObservations?: string;

  @ApiProperty({
    description: 'AI provider',
    enum: ['gemini', 'claude', 'openai'],
    example: 'gemini',
    default: 'gemini',
  })
  aiProvider!: string;
}

/**
 * Response for generate-campaign endpoint.
 */
export const GenerateCampaignResponseSchema = z.object({
  generationId: z.string().uuid(),
  status: z.literal('pending'),
  message: z.string().optional(),
});

export type GenerateCampaignResponse = z.infer<
  typeof GenerateCampaignResponseSchema
>;
