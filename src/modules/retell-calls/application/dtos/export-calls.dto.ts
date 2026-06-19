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

export const ExportCallsSchema = z
  .object({
    format: z.enum(['csv', 'xlsx', 'pdf']).default('xlsx'),
    search: z.string().trim().min(1).optional(),
    callStatus: z.string().trim().min(1).optional(),
    userSentiment: z
      .enum(['Negative', 'Positive', 'Neutral', 'Unknown'])
      .optional(),
    ...statusFlagShape,
    ...trashedFlagsShape,
    ...dateRangeShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
  .refine(rejectMixedStatusAndTrashedFlags, MIXED_STATUS_FLAGS_ERROR)
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class ExportCallsDto extends createZodDto(ExportCallsSchema) {}

export type ExportCallsInput = z.infer<typeof ExportCallsSchema>;
