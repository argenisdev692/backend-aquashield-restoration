import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import type Redis from 'ioredis';
import { ClsService } from 'nestjs-cls';
import { GenerateSocialPostCommand } from '../generate-social-post.command';
import {
  CACHE_PORT,
  type ICachePort,
} from '../../../../../shared/cache/cache.port';
import { MESSAGING_REDIS_CONNECTION } from '../../../../../shared/messaging/messaging.constants';
import { QUEUE_NAMES } from '../../../../../shared/messaging/queues.constants';
import { LoggerService } from '../../../../../logger/logger.service';
import type {
  SelectedIdeaInput,
  SocialPackageContext,
} from '../../../domain/ports/social-post-generation.port';
import {
  buildPackageCacheKey,
  buildPackageJobId,
  SOCIAL_NETWORKS,
  type SocialGenerationJobData,
  type SocialGenerationResult,
} from '../../social/social-generation.util';

@Injectable()
@CommandHandler(GenerateSocialPostCommand)
export class GenerateSocialPostHandler
  implements ICommandHandler<GenerateSocialPostCommand>, OnModuleDestroy
{
  private readonly queueEvents: QueueEvents;

  constructor(
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    @InjectQueue(QUEUE_NAMES.SOCIAL_MEDIA_GENERATION)
    private readonly queue: Queue,
    @Inject(MESSAGING_REDIS_CONNECTION)
    private readonly messagingRedis: Redis,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GenerateSocialPostHandler.name);
    this.queueEvents = new QueueEvents(QUEUE_NAMES.SOCIAL_MEDIA_GENERATION, {
      connection: this.messagingRedis,
    });
  }

  async execute(
    command: GenerateSocialPostCommand,
  ): Promise<SocialGenerationResult> {
    const traceId = this.cls.get<string>('traceId');
    const { dto, actorId } = command;

    const idea: SelectedIdeaInput = dto.selectedIdea;
    const context: SocialPackageContext = {
      niche: dto.niche,
      audience: dto.audience,
      goal: dto.goal,
      voice: dto.voice,
      company: dto.company,
    };

    this.logger.info('GenerateSocialPostHandler start', {
      traceId,
      title: idea.title,
      niche: context.niche,
    });

    const cacheKey = buildPackageCacheKey(idea, context);
    const cached = await this.cache.get<SocialGenerationResult>(cacheKey);
    if (cached) {
      this.logger.info('GenerateSocialPostHandler cache hit', {
        traceId,
        cacheKey,
      });
      return cached;
    }

    const jobData: SocialGenerationJobData = {
      idea,
      context,
      networks: [...SOCIAL_NETWORKS],
      cacheKey,
      userId: actorId,
    };

    const job = await this.queue.add('generate-social-post', jobData, {
      jobId: buildPackageJobId(idea, context),
    });

    this.logger.info('GenerateSocialPostHandler job enqueued', {
      traceId,
      jobId: job.id,
    });

    // Synchronous UX: block the HTTP request until the quality loop finishes
    // (max 5 iterations) so the client only ever sees a package whose scores
    // all pass, or the best attempt with quality_warning.
    const result = (await job.waitUntilFinished(
      this.queueEvents,
    )) as SocialGenerationResult;

    this.logger.info('GenerateSocialPostHandler job completed', {
      traceId,
      jobId: job.id,
      generationId: result.id,
      iterations: result.pkg.metadata?.iterationsRequired,
      qualityWarning: result.pkg.metadata?.qualityWarning,
    });

    return result;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents.close();
  }
}
