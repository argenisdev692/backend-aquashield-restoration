import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../../shared/cache/cache-ttl.constants';
import type { IAuthRateLimiter } from '../../domain/ports/rate-limiter.port';

/**
 * Redis-backed counter for the AccountLocked invariant + generic IP throttle.
 *
 * Increment + TTL is done in a single `MULTI` pipeline so the operations are
 * atomic — a concurrent failure can never increment a key that just expired.
 *
 * Keys are namespaced to avoid colliding with `@nestjs/throttler` (`throttler:*`).
 */
@Injectable()
export class RedisRateLimiterAdapter implements IAuthRateLimiter {
  private readonly prefix = 'auth:rl';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async recordFailure(key: string, windowSeconds: number): Promise<number> {
    return this.increment(`${this.prefix}:${key}`, windowSeconds);
  }

  async clearFailures(key: string): Promise<void> {
    await this.redis.del(`${this.prefix}:${key}`);
  }

  async getFailures(key: string): Promise<number> {
    const v = await this.redis.get(`${this.prefix}:${key}`);
    return v ? Number(v) : 0;
  }

  async recordIpHit(key: string, windowSeconds: number): Promise<number> {
    return this.increment(`${this.prefix}:ip:${key}`, windowSeconds);
  }

  private async increment(fullKey: string, ttlSeconds: number): Promise<number> {
    const pipeline = this.redis.multi();
    pipeline.incr(fullKey);
    // EXPIRE w/ NX (only if no TTL) — first failure sets the window,
    // subsequent failures keep it; resets only after the window elapses.
    pipeline.expire(fullKey, ttlSeconds, 'NX');
    const res = await pipeline.exec();
    if (!res || res.length === 0) {
      throw new Error('Redis pipeline returned no result');
    }
    const [err, value] = res[0] ?? [];
    if (err) throw err;
    return Number(value);
  }
}
