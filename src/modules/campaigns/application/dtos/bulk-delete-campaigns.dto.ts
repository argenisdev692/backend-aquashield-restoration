import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Zod schema for POST /campaigns/bulk-delete request body.
 */
export const BulkDeleteCampaignsSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1, 'At least one ID is required')
    .max(100, 'Maximum 100 IDs per request'),
});

export type BulkDeleteCampaignsDto = z.infer<typeof BulkDeleteCampaignsSchema>;

/**
 * Swagger DTO for POST /campaigns/bulk-delete request body.
 */
export class BulkDeleteCampaignsBody {
  @ApiProperty({
    description: 'Array of campaign generation IDs to delete',
    type: [String],
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '234e5678-e89b-12d3-a456-426614174001',
    ],
  })
  ids!: string[];
}

/**
 * Response for bulk delete operation.
 */
export const BulkDeleteCampaignsResponseSchema = z.object({
  count: z.number(),
  message: z.string(),
});

export type BulkDeleteCampaignsResponse = z.infer<
  typeof BulkDeleteCampaignsResponseSchema
>;
