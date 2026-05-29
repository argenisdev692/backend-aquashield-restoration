/**
 * Cache key patterns for the social-media module.
 *
 * Used with ICachePort.delByPattern for proper invalidation after mutations.
 *
 * MUST mirror the CacheTtlInterceptor key scheme (`http:<userId>:<originalUrl>`)
 * so list/detail GET responses are actually evicted after a mutation.
 */
export const SOCIAL_MEDIA_CACHE_PATTERN = 'http:*:/social-media*';
