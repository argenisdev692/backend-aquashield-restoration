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
 * Public, frontend-friendly alias for {@link TrashedMode}. The CRM UI binds
 * dropdowns / tabs to this enum:
 *
 * - `active`    — row is alive (`deletedAt = null`). Maps to `exclude`.
 * - `suspended` — row was soft-deleted (`deletedAt != null`). Maps to `only`.
 * - `all`       — both. Maps to `include`.
 *
 * Prefer `?status=…` over the raw `withTrashed` / `onlyTrashed` flags on
 * new endpoints — the wording reads better in URLs and analytics. The
 * raw flags remain supported for Laravel-style parity but cannot be mixed
 * with `status` on the same request (see {@link rejectMixedStatusAndTrashedFlags}).
 */
export type EntityStatus = 'active' | 'suspended' | 'all';

/**
 * Map every accepted input — `status`, `withTrashed`, `onlyTrashed` — to a
 * single internal {@link TrashedMode}. Precedence rules:
 *
 * 1. `status` wins if present (it's the canonical public API).
 * 2. Otherwise fall back to the raw flags. `onlyTrashed` beats `withTrashed`,
 *    but the Zod refines forbid both at once.
 * 3. Default → `exclude`.
 */
export function resolveTrashedMode(params: {
  status?: EntityStatus;
  withTrashed?: boolean;
  onlyTrashed?: boolean;
}): TrashedMode {
  if (params.status === 'all') return 'include';
  if (params.status === 'suspended') return 'only';
  if (params.status === 'active') return 'exclude';
  if (params.onlyTrashed) return 'only';
  if (params.withTrashed) return 'include';
  return 'exclude';
}

/**
 * Derive the frontend-facing {@link EntityStatus} from a row's `deletedAt`
 * column. Use it in mappers / read models so responses can expose
 * `status: 'active' | 'suspended'` without forcing the client to null-check.
 *
 *   return { ...row, status: entityStatus(row.deletedAt) };
 */
export function entityStatus(
  deletedAt: Date | string | null | undefined,
): 'active' | 'suspended' {
  return deletedAt ? 'suspended' : 'active';
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
 * Zod schema for the canonical `?status=` query param. Treats empty
 * strings as absent so the frontend can wire dropdowns without
 * conditional URL building.
 */
export const statusQuery = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.enum(['active', 'suspended', 'all']).optional(),
);

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
 * Object shape — spread into any list / export query DTO that prefers the
 * frontend-facing `?status=active|suspended|all` filter instead of (or
 * alongside) the raw `withTrashed` / `onlyTrashed` flags.
 *
 *   export const UsersListQuerySchema = z
 *     .object({
 *       page: z.coerce.number().int().positive().default(1),
 *       ...statusFlagShape,
 *       ...trashedFlagsShape,
 *     })
 *     .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
 *     .refine(rejectMixedStatusAndTrashedFlags, MIXED_STATUS_FLAGS_ERROR);
 */
export const statusFlagShape = {
  status: statusQuery,
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

/**
 * `.refine()` predicate that rejects requests sending `status` together
 * with the raw `withTrashed` / `onlyTrashed` flags. The two APIs are
 * aliases for the same visibility decision — combining them is ambiguous
 * and must fail at the edge instead of silently picking one.
 */
export function rejectMixedStatusAndTrashedFlags(data: {
  status?: EntityStatus;
  withTrashed?: boolean;
  onlyTrashed?: boolean;
}): boolean {
  if (data.status === undefined) return true;
  return data.withTrashed === undefined && data.onlyTrashed === undefined;
}

export const MIXED_STATUS_FLAGS_ERROR: {
  message: string;
  path: PropertyKey[];
} = {
  message:
    'Use either status or withTrashed/onlyTrashed, not both — they are aliases',
  path: ['status'],
};

export interface TrashedFlags {
  withTrashed?: boolean;
  onlyTrashed?: boolean;
}

export interface StatusFlag {
  status?: EntityStatus;
}
