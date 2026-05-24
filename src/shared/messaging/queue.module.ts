import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { messagingRedisProvider } from './messaging-redis.provider';
import { MESSAGING_REDIS_CONNECTION } from './messaging.constants';

/**
 * Global BullMQ root configuration + dedicated Redis connection for messaging.
 *
 * We maintain TWO separate ioredis connections:
 *   1. The one inside BullModule.forRootAsync (used by BullMQ workers & queues internally).
 *   2. MESSAGING_REDIS_CONNECTION (exported here) — for code that needs a live connection
 *      outside of BullMQ's managed clients, e.g. QueueEvents for `waitUntilFinished()`
 *      from a CommandHandler, health checks, custom listeners, etc.
 *
 * This separation is intentional:
 * - BullMQ has strict requirements (maxRetriesPerRequest=null).
 * - It prevents the cache module's connection from being abused for messaging needs.
 * - When you add many queues across modules, everything related to messaging connections
 *   lives in one place.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: new IORedis(config.get<string>('REDIS_URL') as string, {
          maxRetriesPerRequest: null, // BullMQ requirement
        }),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 86_400 },
        },
      }),
    }),
  ],
  providers: [messagingRedisProvider],
  exports: [BullModule, MESSAGING_REDIS_CONNECTION],
})
export class QueueModule {}
