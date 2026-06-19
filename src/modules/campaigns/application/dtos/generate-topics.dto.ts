import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Zod schema for POST /campaigns/generate-topics request body.
 * Step 1 of the 2-step campaign generation process.
 */
export const GenerateTopicsSchema = z.object({
  niche: z.string().min(1).max(255),
  location: z.string().min(1).max(255),
  city: z.string().max(255).optional(),
  state: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  aiObservations: z
    .string()
    .max(400, 'aiObservations must be at most 400 characters')
    .optional(),
  language: z.string().min(2).max(10).default('es'),
});

export type GenerateTopicsDto = z.infer<typeof GenerateTopicsSchema>;

/**
 * Swagger DTO for POST /campaigns/generate-topics request body.
 */
export class GenerateTopicsBody {
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

  @ApiProperty({
    description: 'AI observations (max 400 characters)',
    example: 'Focus on water damage restoration',
    maxLength: 400,
    required: false,
  })
  aiObservations?: string;

  @ApiProperty({ description: 'Language code', example: 'es', default: 'es' })
  language!: string;
}

/**
 * Response for generate-topics endpoint.
 */
export const GenerateTopicsResponseSchema = z.object({
  localMarketAnalysis: z.object({
    targetAudience: z.string(),
    keyPainPoints: z.array(z.string()),
    competitiveLandscape: z.string(),
  }),
  topics: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      score: z.number(),
      funnelStage: z.string(),
    }),
  ),
});

export type GenerateTopicsResponse = z.infer<
  typeof GenerateTopicsResponseSchema
>;
