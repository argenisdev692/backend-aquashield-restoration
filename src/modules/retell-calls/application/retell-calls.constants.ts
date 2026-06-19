/**
 * HTTP response cache key pattern: `http:{userId}:{originalUrl}`. Every
 * mutation / ingest wildcard-invalidates the whole `/retell/calls` namespace
 * so list and detail views never serve a stale snapshot.
 */
export const RETELL_CALLS_CACHE_PATTERN = 'http:*:/retell/calls*';
