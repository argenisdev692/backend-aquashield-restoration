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

export const ExportPostsSchema = z
  .object({
    format: z.enum(['csv', 'xlsx', 'pdf']).default('xlsx'),
    postStatus: z.enum(['draft', 'published', 'scheduled']).optional(),
    categoryId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    search: z.string().optional(),
    ...trashedFlagsShape,
    // Date range filter (inclusive, optional).
    ...dateRangeShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class ExportPostsDto extends createZodDto(ExportPostsSchema) {}

export type ExportPostsInput = z.infer<typeof ExportPostsSchema>;
