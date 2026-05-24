import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import type Redis from 'ioredis';
import { GeneratePostPreviewCommand } from '../generate-post-preview.command';
import { CACHE_PORT, type ICachePort } from '../../../../../shared/cache/cache.port';
import { MESSAGING_REDIS_CONNECTION } from '../../../../../shared/messaging/messaging.constants';
import { QUEUE_NAMES } from '../../../../../shared/messaging/queues.constants';
import { LoggerService } from '../../../../../logger/logger.service';
import { GeneratedPostPreview } from '../../../domain/value-objects/generated-post-preview.vo';
import {
  buildAiPreviewKey,
  buildAiPreviewJobId,
} from '../../ai/ai-preview.util';

@Injectable()
@CommandHandler(GeneratePostPreviewCommand)
export class GeneratePostPreviewHandler
  implements ICommandHandler<GeneratePostPreviewCommand>, OnModuleDestroy
{
  private readonly queueEvents: QueueEvents;

  constructor(
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    @InjectQueue(QUEUE_NAMES.AI_GENERATION)
    private readonly aiQueue: Queue,
    @Inject(MESSAGING_REDIS_CONNECTION)
    private readonly messagingRedis: Redis,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GeneratePostPreviewHandler.name);

    // Required by BullMQ 5+ for waitUntilFinished when calling from outside the worker.
    // We use the dedicated messaging Redis connection (MESSAGING_REDIS_CONNECTION)
    // instead of the cache connection. This is the correct architectural boundary.
    this.queueEvents = new QueueEvents(QUEUE_NAMES.AI_GENERATION, {
      connection: this.messagingRedis,
    });
  }

  async execute(command: GeneratePostPreviewCommand): Promise<GeneratedPostPreview> {
    const traceId = this.cls.get<string>('traceId');
    const { topic, niche, wordCount } = command.dto;

    this.logger.info('GeneratePostPreviewHandler start', {
      traceId,
      topic,
      niche,
      wordCount,
    });

    const cacheKey = buildAiPreviewKey(topic, niche, wordCount);
    const jobId = buildAiPreviewJobId(topic, niche, wordCount);

    // 1. Fast path: Redis cache hit (biggest cost saver for repeated identical generations)
    const cached = await this.cache.get<GeneratedPostPreview>(cacheKey);
    if (cached) {
      this.logger.info('GeneratePostPreviewHandler cache hit', { traceId, jobId });
      return cached;
    }

    // 2. Enqueue job (idempotent via deterministic jobId)
    const job = await this.aiQueue.add(
      'generate-post-preview',
      { topic, niche, wordCount },
      { jobId },
    );

    this.logger.info('GeneratePostPreviewHandler job enqueued', {
      traceId,
      jobId: job.id,
    });

    // 3. Wait for the worker to complete the heavy AI work (Gemini + Tavily + image)
    // This keeps the HTTP request synchronous for the preview UX while the actual
    // expensive calls happen in the BullMQ processor (with retries, cache, etc.).
    const result = await job.waitUntilFinished(this.queueEvents);

    this.logger.info('GeneratePostPreviewHandler job completed', {
      traceId,
      jobId: job.id,
      hasImage: !!result.generatedImageUrl,
      sourcesCount: result.sources.length,
    });

    return result;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents.close();
  }
}
