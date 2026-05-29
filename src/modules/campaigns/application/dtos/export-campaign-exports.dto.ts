import { z } from 'zod';
import {
  dateRangeShape,
  rejectInvertedDateRange,
  INVERTED_DATE_RANGE_ERROR,
} from '../../../../shared/crud/date-range.util';

/**
 * Zod schema for POST /campaigns/exports/export
 * Exports the list of campaign generations (history) as CSV / XLSX / PDF.
 *
 * This is a privileged, auditable operation (expensive + contains business data).
 */
export const ExportCampaignExportsSchema = z
  .object({
    format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
    status: z
      .enum(['pending', 'processing', 'completed', 'failed', 'partial'])
      .optional(),
    ...dateRangeShape,
  })
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export type ExportCampaignExportsInput = z.infer<
  typeof ExportCampaignExportsSchema
>;
