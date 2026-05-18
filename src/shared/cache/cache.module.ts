import { Global, Module } from '@nestjs/common';
import { redisProvider } from './redis.provider';
import { CacheService } from './cache.service';
import { CACHE_PORT } from './cache.port';
import { REDIS_CLIENT } from './cache-ttl.constants';

/**
 * Global cache module — ioredis connection + {@link CacheService}.
 * Consumed by the cache interceptor (concrete `CacheService`) and by
 * application use cases via {@link CACHE_PORT} (Hex/DDD boundary).
 */
@Global()
@Module({
  providers: [
    redisProvider,
    CacheService,
    { provide: CACHE_PORT, useExisting: CacheService },
  ],
  exports: [CacheService, CACHE_PORT, REDIS_CLIENT],
})
export class CacheModule {}
