import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LoggerService } from '../../logger/logger.service';
import { REDIS_CLIENT } from './cache-ttl.constants';

/**
 * Single shared ioredis connection (cache + future BullMQ reuse).
 *
 * BACKEND-NEST §12: use ioredis directly — cache-manager v6 / Keyv store
 * packages are intentionally not on the dependency tree.
 */
export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService, LoggerService],
  useFactory: (config: ConfigService, logger: LoggerService): Redis => {
    logger.setContext('RedisProvider');
    const client = new Redis(config.get<string>('REDIS_URL') as string, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    client.on('error', (err: Error) =>
      logger.error('Redis connection error', {
        layer: 'cache',
        error: err.message,
      }),
    );
    client.on('ready', () =>
      logger.info('Redis connected', { layer: 'cache' }),
    );

    return client;
  },
};
