import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  stringBoolean,
  rejectBothTrashedFlags,
  BOTH_TRASHED_FLAGS_ERROR,
} from '../../../shared/crud/trashed.util';
import {
  dateRangeShape,
  rejectInvertedDateRange,
  INVERTED_DATE_RANGE_ERROR,
} from '../../../shared/crud/date-range.util';

/**
 * `GET /blog-categories` list query.
 *
 * `onlyTrashed` is deliberately NOT exposed here — it lives on the dedicated
 * `GET /blog-categories/trash` route gated by `Action.Restore`. Keeping it off
 * the public list endpoint prevents enumeration of tombstoned rows via the
 * read permission (OWASP API #3 BOPLA).
 */
export const ListBlogCategoryQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    skip: z.coerce.number().int().min(0).optional(),
    withTrashed: stringBoolean.optional(),
    onlyTrashed: stringBoolean.optional(),
    ...dateRangeShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class ListBlogCategoryQueryDto extends createZodDto(
  ListBlogCategoryQuerySchema,
) {}

/** Single-get query — supports `withTrashed` only (Laravel `withTrashed()->find()`). */
export const GetBlogCategoryQuerySchema = z.object({
  withTrashed: stringBoolean.optional(),
});

export class GetBlogCategoryQueryDto extends createZodDto(
  GetBlogCategoryQuerySchema,
) {}

/** `GET /blog-categories/export` query. */
export const ExportBlogCategoryQuerySchema = z
  .object({
    format: z.enum(['csv', 'xlsx', 'pdf']),
    withTrashed: stringBoolean.optional(),
    onlyTrashed: stringBoolean.optional(),
    ...dateRangeShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class ExportBlogCategoryQueryDto extends createZodDto(
  ExportBlogCategoryQuerySchema,
) {}
