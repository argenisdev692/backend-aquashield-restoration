import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import {
  AI_POST_GENERATION_PORT,
  type AiPostGenerationPort,
} from '../../domain/ports/ai-post-generation.port';
import {
  CACHE_PORT,
  type ICachePort,
} from '../../../../shared/cache/cache.port';
import { QUEUE_NAMES } from '../../../../shared/messaging/queues.constants';
import { GeneratedPostPreview } from '../../domain/value-objects/generated-post-preview.vo';
import { PostsGateway } from '../gateways/posts.gateway';

export interface AiPostGenerationJobData {
  topic: string;
  niche: string;
  wordCount: number;
  userId: string;
}

const AI_PREVIEW_TTL_SECONDS = 86_400; // 24 hours — strong cost saving for repeated identical generations

function buildAiPreviewCacheKey(
  topic: string,
  niche: string,
  wordCount: number,
): string {
  // Stable key for dedup + cache hits across identical requests
  const normalized = `${topic.trim().toLowerCase()}|${niche.trim().toLowerCase()}|${wordCount}`;
  // Simple hash to keep key short and safe for Redis
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `ai:preview:${Math.abs(hash)}`;
}

@Injectable()
@Processor(QUEUE_NAMES.AI_GENERATION)
export class AiPostGenerationProcessor extends WorkerHost {
  constructor(
    @Inject(AI_POST_GENERATION_PORT)
    private readonly aiGeneration: AiPostGenerationPort,
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly gateway: PostsGateway,
  ) {
    super();
    this.logger.setContext(AiPostGenerationProcessor.name);
  }

  async process(
    job: Job<AiPostGenerationJobData>,
  ): Promise<GeneratedPostPreview> {
    const { topic, niche, wordCount, userId } = job.data;
    const traceId = this.cls.get<string>('traceId') ?? job.id;

    this.logger.info('AiPostGenerationProcessor start', {
      traceId,
      jobId: job.id,
      topic,
      niche,
      wordCount,
    });

    try {
      const result = await this.doProcess(job);

      this.gateway.broadcastGenerationCompleted({
        userId,
        jobId: job.id as string,
        topic,
        niche,
        wordCount,
        hasImage: !!result.generatedImageUrl,
        sourcesCount: result.sources.length,
      });

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error('AiPostGenerationProcessor failed', {
        traceId,
        jobId: job.id,
        error: errorMessage,
      });

      this.gateway.broadcastGenerationFailed({
        userId,
        jobId: job.id as string,
        topic,
        niche,
        wordCount,
        error: errorMessage,
      });

      throw err;
    }
  }

  private async doProcess(
    job: Job<AiPostGenerationJobData>,
  ): Promise<GeneratedPostPreview> {
    const { topic, niche, wordCount } = job.data;
    const traceId = this.cls.get<string>('traceId') ?? job.id;

    const cacheKey = buildAiPreviewCacheKey(topic, niche, wordCount);

    // Double-check cache inside the worker (defensive + cost protection)
    const cached = await this.cache.get<GeneratedPostPreview>(cacheKey);
    if (cached) {
      this.logger.info('AiPostGenerationProcessor cache hit', {
        traceId,
        jobId: job.id,
      });
      return cached;
    }

    const preview = await this.aiGeneration.generatePreview(
      topic,
      niche,
      wordCount,
    );

    await this.cache.set(cacheKey, preview, AI_PREVIEW_TTL_SECONDS);

    this.logger.info('AiPostGenerationProcessor completed and cached', {
      traceId,
      jobId: job.id,
      hasImage: !!preview.generatedImageUrl,
      sources: preview.sources.length,
    });

    return preview;
  }
}
