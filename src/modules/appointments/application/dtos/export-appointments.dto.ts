import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  statusFlagShape,
  trashedFlagsShape,
  rejectBothTrashedFlags,
  rejectMixedStatusAndTrashedFlags,
  BOTH_TRASHED_FLAGS_ERROR,
  MIXED_STATUS_FLAGS_ERROR,
} from '../../../../shared/crud/trashed.util';
import {
  dateRangeShape,
  rejectInvertedDateRange,
  INVERTED_DATE_RANGE_ERROR,
} from '../../../../shared/crud/date-range.util';

export const ExportAppointmentsSchema = z
  .object({
    format: z.enum(['csv', 'xlsx', 'pdf']).default('xlsx'),
    statusLead: z.enum(['New', 'Called', 'Pending', 'Declined']).optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    owner: z.string().optional(),
    // Canonical soft-delete visibility: ?status=active|suspended|all.
    ...statusFlagShape,
    // Laravel-style raw aliases (kept for parity; cannot be mixed with status).
    ...trashedFlagsShape,
    // Date-range filter (inclusive window on `createdAt`).
    ...dateRangeShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
  .refine(rejectMixedStatusAndTrashedFlags, MIXED_STATUS_FLAGS_ERROR)
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class ExportAppointmentsDto extends createZodDto(
  ExportAppointmentsSchema,
) {}

export type ExportAppointmentsInput = z.infer<typeof ExportAppointmentsSchema>;
