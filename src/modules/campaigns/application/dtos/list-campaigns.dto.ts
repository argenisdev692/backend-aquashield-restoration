import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  dateRangeShape,
  rejectInvertedDateRange,
  INVERTED_DATE_RANGE_ERROR,
} from '../../../../shared/crud/date-range.util';

/**
 * Zod schema for GET /campaigns query parameters.
 */
export const ListCampaignsSchema = z
  .object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
    status: z.enum(['pending', 'processing', 'completed', 'failed', 'partial']).optional(),
    withTrashed: z.coerce.boolean().default(false),
    onlyTrashed: z.coerce.boolean().default(false),
    ...dateRangeShape,
  })
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export type ListCampaignsDto = z.infer<typeof ListCampaignsSchema>;
