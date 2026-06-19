import { z } from 'zod';
import {
  statusFlagShape,
  trashedFlagsShape,
  rejectBothTrashedFlags,
  rejectMixedStatusAndTrashedFlags,
  BOTH_TRASHED_FLAGS_ERROR,
  MIXED_STATUS_FLAGS_ERROR,
} from '../../../shared/crud/trashed.util';
import {
  dateRangeShape,
  rejectInvertedDateRange,
  INVERTED_DATE_RANGE_ERROR,
} from '../../../shared/crud/date-range.util';

export const ExceptionFilterSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    isAvailable: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    ...statusFlagShape,
    ...trashedFlagsShape,
    ...dateRangeShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
  .refine(rejectMixedStatusAndTrashedFlags, MIXED_STATUS_FLAGS_ERROR)
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export type ExceptionFilterDto = z.infer<typeof ExceptionFilterSchema>;

/** `GET /availability/exceptions/export` query — same filters as list, no pagination. */
export const ExceptionExportQuerySchema = z
  .object({
    format: z.enum(['csv', 'xlsx']),
    isAvailable: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    ...statusFlagShape,
    ...trashedFlagsShape,
    ...dateRangeShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
  .refine(rejectMixedStatusAndTrashedFlags, MIXED_STATUS_FLAGS_ERROR)
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export type ExceptionExportQueryDto = z.infer<typeof ExceptionExportQuerySchema>;
