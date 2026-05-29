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

export const AppointmentFiltersSchema = z
  .object({
    statusLead: z.enum(['New', 'Called', 'Pending', 'Declined']).optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    owner: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    // Laravel-style soft-delete visibility (default: only active rows).
    ...trashedFlagsShape,
    // Date-range filter (inclusive window on `createdAt`).
    ...dateRangeShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class AppointmentFiltersDto extends createZodDto(
  AppointmentFiltersSchema,
) {}

export type AppointmentFiltersInput = z.infer<typeof AppointmentFiltersSchema>;
