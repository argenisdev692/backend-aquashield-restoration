import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  dateRangeShape,
  rejectInvertedDateRange,
  INVERTED_DATE_RANGE_ERROR,
} from '../../../../shared/crud/date-range.util';

export const ListSocialMediaSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    niche: z.string().max(120).optional(),
    language: z.string().max(10).optional(),
    network: z
      .enum(['facebook', 'instagram', 'tiktok', 'linkedin', 'twitter'])
      .optional(),
    ...dateRangeShape,
  })
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class ListSocialMediaDto extends createZodDto(ListSocialMediaSchema) {}

export type ListSocialMediaInput = z.infer<typeof ListSocialMediaSchema>;
