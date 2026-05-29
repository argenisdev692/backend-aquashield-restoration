import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  dateRangeShape,
  rejectInvertedDateRange,
  INVERTED_DATE_RANGE_ERROR,
} from '../../../../shared/crud/date-range.util';

export const ExportSocialMediaSchema = z
  .object({
    format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
    niche: z.string().max(120).optional(),
    language: z.string().max(10).optional(),
    network: z
      .enum(['facebook', 'instagram', 'tiktok', 'linkedin', 'twitter'])
      .optional(),
    ...dateRangeShape,
  })
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class ExportSocialMediaDto extends createZodDto(
  ExportSocialMediaSchema,
) {}

export type ExportSocialMediaInput = z.infer<typeof ExportSocialMediaSchema>;
