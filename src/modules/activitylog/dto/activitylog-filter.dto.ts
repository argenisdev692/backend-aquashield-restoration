import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  dateRangeShape,
  rejectInvertedDateRange,
  INVERTED_DATE_RANGE_ERROR,
} from '../../../shared/crud/date-range.util';

export const ActivityLogFilterSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    actorId: z.string().uuid().optional(),
    action: z.string().max(100).optional(),
    resourceId: z.string().max(64).optional(),
    ...dateRangeShape,
  })
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class ActivityLogFilterDto extends createZodDto(
  ActivityLogFilterSchema,
) {}
