/**
 * ICachePort — application-facing cache contract.
 *
 * Keeps the concrete Redis/`CacheService` infrastructure out of the
 * application layer (Hex/DDD). The cache is an optimization, never a hard
 * dependency: implementations log-and-swallow transport failures.
 */
export interface ICachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPattern(pattern: string): Promise<void>;
}

export const CACHE_PORT = Symbol('ICachePort');
