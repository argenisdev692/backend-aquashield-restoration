/**
 * Hex/DDD cache invalidation pattern for the posts bounded context.
 * Uses the service-scoped convention required by ARCHITECTURE-NEST for Hex/DDD modules.
 * Write handlers invalidate this pattern (and targeted item keys where applicable).
 *
 * Note: The controller read routes (GET /posts, GET /posts/:id) currently rely on
 * the global CacheTtlInterceptor which uses http:{userId}:{originalUrl} keys.
 * To fully eliminate the previous mixed scheme, those routes use @SkipCache()
 * and caching responsibility moves to the QueryHandlers (or remains uncached for now).
 */
export const POSTS_CACHE_PATTERN = 'posts-service:post:*';
