/**
 * Shared escape helpers for CSV / XLSX exports.
 *
 * Defuses CSV/Formula-injection (OWASP — Excel/LibreOffice/Google Sheets
 * evaluate cells starting with `=`, `+`, `-`, `@`, `\t` or `\r` as formulas).
 * Both helpers prefix the value with a single quote in that case so the cell
 * is rendered as text.
 *
 * - `csvEscape` wraps in `"`, doubles inner `"`, and is safe to join with `,`.
 *   Null/undefined → `""` (an empty quoted cell — equivalent to `,,` per RFC 4180).
 * - `sheetEscape` returns the raw primitive for `number`/`boolean` so ExcelJS
 *   preserves the column type; everything else is stringified.
 *
 * Inputs are typed as `unknown` so callers can pass Date/objects/etc. without
 * pre-coercion (uses `String(value)` internally). The `ExportPrimitive` type
 * is exported as a hint for typed call sites.
 */

export type ExportPrimitive = string | number | boolean | null | undefined;

const DANGEROUS_LEADING_CHAR = /^[=+\-@\t\r]/;

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  // String() handles number/boolean/bigint and falls back to .toString() for objects.
  return String(value);
}

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const raw = stringifyValue(value);
  const safe = DANGEROUS_LEADING_CHAR.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function sheetEscape(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const raw = stringifyValue(value);
  return DANGEROUS_LEADING_CHAR.test(raw) ? `'${raw}` : raw;
}
