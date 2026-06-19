import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  statusFlagShape,
  trashedFlagsShape,
  rejectBothTrashedFlags,
  BOTH_TRASHED_FLAGS_ERROR,
  rejectMixedStatusAndTrashedFlags,
  MIXED_STATUS_FLAGS_ERROR,
} from '../../../../shared/crud/trashed.util';
import {
  dateRangeShape,
  rejectInvertedDateRange,
  INVERTED_DATE_RANGE_ERROR,
} from '../../../../shared/crud/date-range.util';

export const CallFiltersSchema = z
  .object({
    // free-text search over phone numbers, summary and transcript
    search: z.string().trim().min(1).optional(),
    callStatus: z.string().trim().min(1).optional(),
    userSentiment: z
      .enum(['Negative', 'Positive', 'Neutral', 'Unknown'])
      .optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    // canonical soft-delete visibility (?status=) + Laravel-style raw flags
    ...statusFlagShape,
    ...trashedFlagsShape,
    // inclusive date window on `startedAt`
    ...dateRangeShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
  .refine(rejectMixedStatusAndTrashedFlags, MIXED_STATUS_FLAGS_ERROR)
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class CallFiltersDto extends createZodDto(CallFiltersSchema) {}

export type CallFiltersInput = z.infer<typeof CallFiltersSchema>;
