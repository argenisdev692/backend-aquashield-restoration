import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import type Redis from 'ioredis';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import {
  SOCIAL_MEDIA_JOB_PORT,
  type ISocialMediaJobPort,
  type EnqueueGeneratePostInput,
  type EnqueueGeneratePostResult,
} from '../../domain/ports/social-media-job.port';
import { QUEUE_NAMES } from '../../../../shared/messaging/queues.constants';
import { MESSAGING_REDIS_CONNECTION } from '../../../../shared/messaging/messaging.constants';

@Injectable()
export class SocialMediaJobAdapter
  implements ISocialMediaJobPort, OnModuleDestroy
{
  private readonly queueEvents: QueueEvents;

  constructor(
    @InjectQueue(QUEUE_NAMES.SOCIAL_MEDIA_GENERATION)
    private readonly socialMediaQueue: Queue,
    @Inject(MESSAGING_REDIS_CONNECTION)
    private readonly messagingRedis: Redis,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(SocialMediaJobAdapter.name);

    this.queueEvents = new QueueEvents(QUEUE_NAMES.SOCIAL_MEDIA_GENERATION, {
      connection: this.messagingRedis,
    });
  }

  async enqueueGeneratePost(
    input: EnqueueGeneratePostInput,
  ): Promise<EnqueueGeneratePostResult> {
    const { actorId, topicTitle, topicDescription, activeNetworks, language } =
      input;
    const traceId = this.cls.get<string>('traceId');

    const jobId = `smg:${actorId}:${Buffer.from(
      JSON.stringify({
        topic: topicTitle,
        networks: [...activeNetworks].sort(),
        lang: language,
      }),
    ).toString('base64url')}`;

    const job = await this.socialMediaQueue.add(
      'generate-social-media-post',
      {
        actorId,
        topicTitle,
        topicDescription,
        activeNetworks,
        language,
      },
      { jobId },
    );

    this.logger.info('SocialMediaJobAdapter job enqueued', {
      traceId,
      jobId: job.id,
    });

    return {
      jobId: job.id as string,
      status: 'queued',
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents.close();
  }
}
