import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { LoggerService } from '../../logger/logger.service';
import { REDIS_CLIENT } from './cache-ttl.constants';

/**
 * Typed Redis cache facade.
 *
 * - JSON-serialized values with mandatory TTL on writes.
 * - `delByPattern` uses non-blocking SCAN (never `KEYS`, never `FLUSHALL`).
 * - Read/write failures are logged and swallowed: the cache is an
 *   optimization, never a hard dependency on the request path.
 */
@Injectable()
export class CacheService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(CacheService.name);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      this.logger.warn('Cache get failed', {
        layer: 'cache',
        key,
        error: (err as Error).message,
      });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn('Cache set failed', {
        layer: 'cache',
        key,
        error: (err as Error).message,
      });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn('Cache del failed', {
        layer: 'cache',
        key,
        error: (err as Error).message,
      });
    }
  }

  /** Removes every key matching `pattern` (e.g. `users-service:users:list:*`). */
  async delByPattern(pattern: string): Promise<void> {
    try {
      const stream = this.redis.scanStream({ match: pattern, count: 100 });
      const pipeline = this.redis.pipeline();
      let queued = 0;

      for await (const keys of stream as AsyncIterable<string[]>) {
        for (const key of keys) {
          pipeline.del(key);
          queued += 1;
        }
      }

      if (queued > 0) {
        await pipeline.exec();
      }
    } catch (err) {
      this.logger.warn('Cache delByPattern failed', {
        layer: 'cache',
        pattern,
        error: (err as Error).message,
      });
    }
  }
}
