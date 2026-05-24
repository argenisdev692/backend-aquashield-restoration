import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { LoggerService } from '../../logger/logger.service';
import { MESSAGING_REDIS_CONNECTION } from './messaging.constants';

/**
 * Dedicated ioredis connection for BullMQ / messaging workloads.
 *
 * BullMQ has strict requirements (maxRetriesPerRequest must be null).
 * We keep this completely separate from the cache connection (`REDIS_CLIENT` in cache module)
 * so that:
 *   - Messaging traffic does not affect cache performance/latency.
 *   - We can tune / monitor / scale the messaging Redis usage independently.
 *   - Code that needs the live connection (QueueEvents, custom workers, etc.) has an explicit token.
 *
 * This provider is exported by QueueModule (which is already @Global()).
 */
export const messagingRedisProvider: Provider = {
  provide: MESSAGING_REDIS_CONNECTION,
  inject: [ConfigService, LoggerService],
  useFactory: (config: ConfigService, logger: LoggerService) => {
    logger.setContext('MessagingRedisProvider');

    const client = new IORedis(config.get<string>('REDIS_URL') as string, {
      maxRetriesPerRequest: null, // REQUIRED by BullMQ
      enableReadyCheck: true,
      lazyConnect: false,
    });

    client.on('error', (err: Error) =>
      logger.error('Messaging Redis connection error', {
        layer: 'messaging',
        error: err.message,
      }),
    );

    client.on('ready', () =>
      logger.info('Messaging Redis connected', { layer: 'messaging' }),
    );

    return client;
  },
};
