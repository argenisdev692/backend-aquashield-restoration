import { randomBytes } from 'node:crypto';

/**
 * Crockford Base32 alphabet — no `I`, `L`, `O`, `U` to avoid confusion when
 * the user has to type the code from a printed sheet.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

/**
 * Generate `count` backup codes, each of `length` characters, formatted as
 * `XXXX-XXXXXX` (4-6 dash) for readability.
 *
 * Default: 8 codes × 10 chars (matches Laravel reference spec).
 */
export function generateBackupCodes(
  count: number = 8,
  length: number = 10,
): string[] {
  if (length < 8 || length > 32) {
    throw new Error('Backup code length must be between 8 and 32');
  }
  return Array.from({ length: count }, () => formatCode(randomCode(length)));
}

function randomCode(length: number): string {
  const buf = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET.charAt(buf[i] % ALPHABET.length);
  }
  return out;
}

function formatCode(raw: string): string {
  // Insert a dash after the 4th character for readability.
  if (raw.length <= 4) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}
