import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

/**
 * Global BullMQ root configuration.
 *
 * Provides the shared Redis connection + default job options. Feature
 * modules add their own queues/processors via `BullModule.registerQueue`
 * (in infrastructure/jobs) using {@link QUEUE_NAMES}.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Dedicated connection: BullMQ requires maxRetriesPerRequest=null.
        connection: new IORedis(config.get<string>('REDIS_URL') as string, {
          maxRetriesPerRequest: null,
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
  exports: [BullModule],
})
export class QueueModule {}
