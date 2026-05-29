import { randomInt } from 'node:crypto';

/**
 * Generate a zero-padded N-digit numeric OTP code using a CSPRNG
 * (`crypto.randomInt`) — NOT `Math.random()` (predictable).
 *
 * Default length 6 (email_verify / password_reset). For login OTP use 4
 * or 6 depending on UX preference.
 */
export function generateNumericCode(length: number = 6): string {
  if (length < 4 || length > 10) {
    throw new Error('Numeric code length must be between 4 and 10');
  }
  const max = 10 ** length;
  const value = randomInt(0, max);
  return value.toString().padStart(length, '0');
}

/**
 * Constant-time string compare. Avoids early-exit timing leaks when an
 * attacker is probing OTPs or backup codes.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
