import { parsePhoneNumberWithError } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
import { z } from 'zod';

/**
 * Phone-number policy for this product:
 *
 * - Only three countries are accepted: Portugal, United States, Spain.
 * - Portugal is the default country when the input omits an international
 *   prefix (e.g. `912345678` is parsed as `+351 912 345 678`).
 * - Storage is always E.164 (`+351912345678`) — no separators, no national
 *   prefix. Pretty formatting is applied on read (presenters, exports).
 */
export const ALLOWED_PHONE_COUNTRIES = ['PT', 'US', 'ES'] as const;
export type AllowedPhoneCountry = (typeof ALLOWED_PHONE_COUNTRIES)[number];
export const DEFAULT_PHONE_COUNTRY: AllowedPhoneCountry = 'PT';

const ALLOWED_SET = new Set<CountryCode>(ALLOWED_PHONE_COUNTRIES);

/**
 * Parse, validate and normalize a phone number to E.164.
 *
 * Accepts either an international format (`+351912345678`, `+14155552671`,
 * `+34612345678`) or a national number that will be interpreted under the
 * default country (`912345678` → `+351912345678`).
 *
 * Throws `Error('Invalid phone number')` when the input cannot be parsed,
 * is not a valid number, or belongs to a country outside the allowed list.
 */
export function normalizePhoneE164(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Phone number is empty');
  }

  const parsed = parsePhoneNumberWithError(trimmed, DEFAULT_PHONE_COUNTRY);
  if (!parsed.isValid()) {
    throw new Error('Invalid phone number');
  }
  if (!parsed.country || !ALLOWED_SET.has(parsed.country)) {
    throw new Error(
      `Phone country not supported — allowed: ${ALLOWED_PHONE_COUNTRIES.join(', ')}`,
    );
  }
  return parsed.number; // E.164 (e.g. +351912345678)
}

/**
 * Format a stored E.164 number for display.
 *
 * Output uses the libphonenumber `INTERNATIONAL` format:
 *   `+351 912 345 678` · `+1 415 555 2671` · `+34 612 34 56 78`
 *
 * Returns `null` when the input is null/empty. Returns the raw value when
 * libphonenumber cannot parse it (defensive — should not happen for data
 * that went through `normalizePhoneE164` on write).
 */
export function formatPhonePretty(e164: string | null): string | null {
  if (!e164) return null;
  try {
    const parsed = parsePhoneNumberWithError(e164);
    return parsed.formatInternational();
  } catch {
    return e164;
  }
}

/**
 * Zod schema fragment for optional phone fields. Validates AND normalizes:
 * the value reaching the handler is always either `undefined` or a clean
 * E.164 string.
 *
 * Usage:
 *   z.object({
 *     ...,
 *     phone: phoneSchema.optional(),
 *   })
 */
export const phoneSchema = z
  .string()
  .min(1)
  .max(20)
  .transform((val, ctx) => {
    try {
      return normalizePhoneE164(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          err instanceof Error
            ? err.message
            : 'Invalid phone — must be a valid PT, US or ES number',
      });
      return z.NEVER;
    }
  });
