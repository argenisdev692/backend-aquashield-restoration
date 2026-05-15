import { SetMetadata } from '@nestjs/common';

export const CACHE_TTL_KEY = 'cache_ttl_seconds';

/**
 * Declares the cache TTL (seconds) for a GET handler. Read by
 * `CacheTtlInterceptor`. Always pass a `TTL_SECONDS` constant — never a
 * magic number. Every GET handler MUST declare one.
 */
export const CacheTTL = (seconds: number) =>
  SetMetadata(CACHE_TTL_KEY, seconds);
