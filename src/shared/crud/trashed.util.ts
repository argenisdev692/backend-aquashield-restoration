import { z } from 'zod';

/**
 * Soft-delete visibility mode. Mirrors Laravel's Eloquent semantics:
 *
 * - `exclude` (default) — only non-deleted rows. `Model::query()`.
 * - `include`           — both active and soft-deleted. `Model::withTrashed()`.
 * - `only`              — only soft-deleted rows. `Model::onlyTrashed()`.
 *
 * Used by every CRUD list / single-get / export path that supports soft delete.
 */
export type TrashedMode = 'exclude' | 'include' | 'only';

/**
 * Map the two HTTP query booleans (`withTrashed`, `onlyTrashed`) to a
 * single mode. `onlyTrashed` wins if both happen to be true at the same
 * time, but the Zod schema below rejects that combination at the edge.
 */
export function resolveTrashedMode(params: {
  withTrashed?: boolean;
  onlyTrashed?: boolean;
}): TrashedMode {
  if (params.onlyTrashed) return 'only';
  if (params.withTrashed) return 'include';
  return 'exclude';
}

/**
 * Build the Prisma `where` fragment for the given mode. Returns an object
 * that can be spread into a larger `where` clause:
 *
 *   const where = { ...buildTrashedWhere(mode), email: 'a@b.c' };
 */
export function buildTrashedWhere(mode: TrashedMode): {
  deletedAt?: null | { not: null };
} {
  switch (mode) {
    case 'include':
      return {};
    case 'only':
      return { deletedAt: { not: null } };
    case 'exclude':
    default:
      return { deletedAt: null };
  }
}

/**
 * Zod-friendly coercion of `'true'`/`'false'` query strings to booleans.
 *
 * `z.coerce.boolean()` is unsafe for HTTP query strings — it returns
 * `true` for the literal string `'false'` because `Boolean('false')` is
 * truthy. This helper handles both raw booleans (for programmatic use)
 * and the canonical `'true'`/`'false'` strings.
 */
export const stringBoolean = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');

/**
 * Object shape — spread into any list / single-get / export query DTO
 * that should expose soft-deleted rows under the standard Laravel-style
 * contract.
 *
 * Usage:
 *
 *   export const UsersListQuerySchema = z
 *     .object({
 *       page: z.coerce.number().int().positive().default(1),
 *       ...trashedFlagsShape,
 *     })
 *     .refine(rejectBothTrashedFlags, { ... });
 */
export const trashedFlagsShape = {
  withTrashed: stringBoolean.optional(),
  onlyTrashed: stringBoolean.optional(),
} as const;

/**
 * `.refine()` predicate that rejects requests sending both
 * `withTrashed=true` and `onlyTrashed=true` at the same time. Pair it
 * with `trashedFlagsShape` so the resolved {@link TrashedMode} is always
 * unambiguous.
 */
export function rejectBothTrashedFlags(data: {
  withTrashed?: boolean;
  onlyTrashed?: boolean;
}): boolean {
  return !(data.withTrashed && data.onlyTrashed);
}

export const BOTH_TRASHED_FLAGS_ERROR: {
  message: string;
  path: PropertyKey[];
} = {
  message: 'Use either withTrashed or onlyTrashed, not both',
  path: ['onlyTrashed'],
};

export interface TrashedFlags {
  withTrashed?: boolean;
  onlyTrashed?: boolean;
}
