import { Global, Module } from '@nestjs/common';
import { redisProvider } from './redis.provider';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './cache-ttl.constants';

/**
 * Global cache module — ioredis connection + {@link CacheService}.
 * Consumed by the cache interceptor and by write use cases for invalidation.
 */
@Global()
@Module({
  providers: [redisProvider, CacheService],
  exports: [CacheService, REDIS_CLIENT],
})
export class CacheModule {}
