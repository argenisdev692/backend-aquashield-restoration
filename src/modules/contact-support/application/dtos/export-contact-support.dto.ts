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

export const ExportContactSupportSchema = z
  .object({
    format: z.enum(['csv', 'pdf']).default('csv'),
    /** `true` → only read, `false` → only unread, omitted → all. */
    isRead: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    ...trashedFlagsShape,
    // Date range filter (inclusive, optional).
    ...dateRangeShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class ExportContactSupportDto extends createZodDto(
  ExportContactSupportSchema,
) {}
