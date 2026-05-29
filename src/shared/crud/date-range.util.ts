import { z } from 'zod';

/**
 * Inclusive `[startDate, endDate]` range used to scope list / single-get /
 * export queries by a timestamp column (default `createdAt`).
 *
 * Both ends are optional — passing only `startDate` yields "since X",
 * passing only `endDate` yields "up to Y", passing neither yields the
 * full set.
 */
export interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

/**
 * HTTP-shaped flags exposed on the query string. Snake-case is deliberate
 * for free-form date filters — it keeps date params visually distinct
 * from camelCase pagination / sort flags and mirrors the cross-team
 * convention used across the CRM frontend.
 */
export interface DateRangeFlags {
  start_date?: Date;
  end_date?: Date;
}

/** Translate the two query inputs into the internal range object. */
export function resolveDateRange(params: DateRangeFlags): DateRange {
  return {
    startDate: params.start_date,
    endDate: params.end_date,
  };
}

/**
 * Build the Prisma `where` fragment for the given range. Returns an
 * empty object when no bound was supplied so it can be safely spread:
 *
 *   const where = { ...buildDateRangeWhere(range), tenantId };
 *
 * The `column` argument selects which timestamp to filter on —
 * `createdAt` by default. Pass `'updatedAt'`, `'scheduledAt'`, etc. for
 * modules that filter on a different field.
 */
export function buildDateRangeWhere(
  range: DateRange,
  column: string = 'createdAt',
): Record<string, { gte?: Date; lte?: Date }> {
  if (!range.startDate && !range.endDate) return {};
  const filter: { gte?: Date; lte?: Date } = {};
  if (range.startDate) filter.gte = range.startDate;
  if (range.endDate) filter.lte = range.endDate;
  return { [column]: filter };
}

/**
 * Zod-friendly parsing of a `YYYY-MM-DD` query string into a `Date`.
 *
 * We validate an ISO date *string* (`z.iso.date()`) and then transform it
 * into a `Date`, instead of `z.coerce.date()`. The output stays a `Date`
 * (so repositories and {@link resolveDateRange} are unchanged), but the
 * JSON-Schema-facing *input* is a plain string — `z.coerce.date()` emits a
 * `Date` node that `nestjs-zod`'s OpenAPI generator cannot represent
 * (`Error: Date cannot be represented in JSON Schema`).
 *
 * Treats `''` (empty query value) as absent so the frontend can wire the
 * inputs without conditional URL building.
 */
export const dateQuery = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.iso
    .date()
    .transform((s) => new Date(s))
    .optional(),
);

/**
 * Object shape — spread into any list / single-get / export query DTO
 * that should expose the standard between-dates contract.
 *
 *   export const WidgetsListQuerySchema = z
 *     .object({
 *       page: z.coerce.number().int().positive().default(1),
 *       ...dateRangeShape,
 *     })
 *     .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);
 */
export const dateRangeShape = {
  start_date: dateQuery,
  end_date: dateQuery,
} as const;

/**
 * `.refine()` predicate that rejects `start_date > end_date`. Pair it
 * with `dateRangeShape` so the resolved {@link DateRange} is always
 * monotonic.
 */
export function rejectInvertedDateRange(data: {
  start_date?: Date;
  end_date?: Date;
}): boolean {
  if (!data.start_date || !data.end_date) return true;
  return data.start_date.getTime() <= data.end_date.getTime();
}

export const INVERTED_DATE_RANGE_ERROR: {
  message: string;
  path: PropertyKey[];
} = {
  message: 'start_date must be earlier than or equal to end_date',
  path: ['end_date'],
};
