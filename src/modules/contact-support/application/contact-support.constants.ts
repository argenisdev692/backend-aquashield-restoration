import { z } from 'zod';

/**
 * Shared cache pattern for every contact-support write path. Mirrors the
 * `CacheTtlInterceptor` key scheme `http:{userId}:{originalUrl}` so a single
 * `delByPattern` call invalidates every cached list/detail response.
 */
export const CONTACT_SUPPORT_CACHE_PATTERN = 'http:*:/contact-support*';

/**
 * Query flag shared by the list and export DTOs:
 * `true` → only read, `false` → only unread, omitted → all.
 */
export const isReadFlag = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));
