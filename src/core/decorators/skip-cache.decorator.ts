import { SetMetadata } from '@nestjs/common';

export const SKIP_CACHE_KEY = 'skip_cache';

/**
 * Bypasses `CacheTtlInterceptor` for a route. Mandatory on export
 * endpoints and any route that must always reflect live state.
 */
export const SkipCache = () => SetMetadata(SKIP_CACHE_KEY, true);
