import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify a Retell `x-retell-signature` header. Retell signs the EXACT raw
 * request bytes with your API key (HMAC-SHA256, hex). Constant-time compare;
 * fails closed on a missing/short signature.
 *
 * Kept dependency-free (no cockatiel/SDK imports) so it is unit-testable in
 * isolation and reusable by both the adapter and the guard.
 */
export function verifyRetellSignature(
  rawBody: string,
  signature: string | undefined,
  apiKey: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', apiKey)
    .update(rawBody, 'utf8')
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
