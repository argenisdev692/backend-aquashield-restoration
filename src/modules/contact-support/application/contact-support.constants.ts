/**
 * Shared cache pattern for every contact-support write path. Mirrors the
 * `CacheTtlInterceptor` key scheme `http:{userId}:{originalUrl}` so a single
 * `delByPattern` call invalidates every cached list/detail response.
 */
export const CONTACT_SUPPORT_CACHE_PATTERN = 'http:*:/contact-support*';
