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

export const ListContactSupportSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    /** `true` → only read, `false` → only unread, omitted → all. */
    isRead: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    // Laravel-style soft-delete visibility (default: only active rows).
    ...trashedFlagsShape,
    // Date range filter (inclusive, optional).
    ...dateRangeShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class ListContactSupportDto extends createZodDto(
  ListContactSupportSchema,
) {}
