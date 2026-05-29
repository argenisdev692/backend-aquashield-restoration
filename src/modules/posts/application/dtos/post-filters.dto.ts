import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  trashedFlagsShape,
  rejectBothTrashedFlags,
  BOTH_TRASHED_FLAGS_ERROR,
} from '../../../../shared/crud/trashed.util';
import {
  dateRangeShape,
  rejectInvertedDateRange,
  INVERTED_DATE_RANGE_ERROR,
} from '../../../../shared/crud/date-range.util';

export const PostFiltersSchema = z
  .object({
    postStatus: z.enum(['draft', 'published', 'scheduled']).optional(),
    categoryId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    // Laravel-style soft-delete visibility (default: only active rows).
    ...trashedFlagsShape,
    // Date range filter (inclusive, optional).
    ...dateRangeShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class PostFiltersDto extends createZodDto(PostFiltersSchema) {}

export type PostFiltersInput = z.infer<typeof PostFiltersSchema>;
