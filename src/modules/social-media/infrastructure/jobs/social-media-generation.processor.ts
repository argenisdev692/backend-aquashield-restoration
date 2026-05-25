import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '../../../../logger/logger.service';
import { TOPIC_FINDER_PORT } from '../../domain/ports/topic-finder.port';
import type { ITopicFinderPort } from '../../domain/ports/topic-finder.port';
import { POST_GENERATOR_PORT } from '../../domain/ports/post-generator.port';
import type { IPostGeneratorPort } from '../../domain/ports/post-generator.port';
import { IMAGE_GENERATOR_PORT } from '../../domain/ports/image-generator.port';
import type { IImageGeneratorPort } from '../../domain/ports/image-generator.port';
import { SOCIAL_MEDIA_REPOSITORY } from '../../domain/ports/social-media-repository.port';
import type { ISocialMediaRepository } from '../../domain/ports/social-media-repository.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { StorageService } from '../../../../shared/storage/storage.service';
import { QUEUE_NAMES } from '../../../../shared/messaging/queues.constants';
import type {
  SocialNetwork,
  GeneratedPost,
  GeneratedPostImage,
} from '../../domain/entities/social-media-generation.entity';
import { SocialMediaGenerationAggregate } from '../../domain/entities/social-media-generation.aggregate';
import { SocialMediaGenerationCreatedEvent } from '../../domain/events/social-media-generation-created.event';
import { CACHE_PORT, type ICachePort } from '../../../../shared/cache/cache.port';
import { SOCIAL_MEDIA_CACHE_PATTERN } from '../../application/social-media-cache.constants';

export interface SocialMediaGenerationJobData {
  actorId: string;
  topicTitle: string;
  topicDescription: string;
  activeNetworks: SocialNetwork[];
  language?: string;
}

export interface SocialMediaGenerationJobResult {
  id: string;
  r2Key?: string;
}

@Processor(QUEUE_NAMES.SOCIAL_MEDIA_GENERATION)
@Injectable()
export class SocialMediaGenerationProcessor extends WorkerHost {
  constructor(
    @Inject(TOPIC_FINDER_PORT)
    private readonly topicFinder: ITopicFinderPort,
    @Inject(POST_GENERATOR_PORT)
    private readonly generator: IPostGeneratorPort,
    @Inject(SOCIAL_MEDIA_REPOSITORY)
    private readonly repo: ISocialMediaRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    @Inject(IMAGE_GENERATOR_PORT)
    private readonly imageGenerator: IImageGeneratorPort,
    private readonly storage: StorageService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
    this.logger.setContext(SocialMediaGenerationProcessor.name);
  }

  async process(
    job: Job<SocialMediaGenerationJobData>,
  ): Promise<SocialMediaGenerationJobResult> {
    const { actorId, topicTitle, topicDescription, activeNetworks, language = 'es' } = job.data;
    const traceId = this.cls.get<string>('traceId') ?? job.id;

    this.logger.info('SocialMediaGenerationProcessor start', {
      traceId,
      jobId: job.id,
      actorId,
      networks: activeNetworks,
    });

    // 1. Generate posts via Gemini (single structured call)
    const generatedPostsMap = await this.generator.generatePosts({
      topicTitle,
      topicDescription,
      activeNetworks,
      language,
    });

    const generatedPosts: Partial<Record<SocialNetwork, GeneratedPost>> = {};
    for (const net of activeNetworks) {
      const post = generatedPostsMap[net];
      if (post) {
        generatedPosts[net] = {
          body: post.body,
          hashtags: post.hashtags,
          ...(post.emojis ? { emojis: post.emojis } : {}),
          ...(post.hook ? { hook: post.hook } : {}),
        };
      }
    }

    // 1.5 Image generation (Google Gen AI via shared IAiClient)
    // Best-effort: a failure here must never break the text post generation.
    let sharedImage: GeneratedPostImage | undefined;
    try {
      const imageResult = await this.imageGenerator.generateImage({
        prompt: `${topicTitle}. ${topicDescription}`,
        aspectRatio: '1:1',
      });

      const imageKey = `social-media/images/${actorId}/${Date.now()}.png`;
      const imageBuffer = Buffer.from(imageResult.base64, 'base64');

      await this.storage.upload(imageKey, imageBuffer, imageResult.mimeType || 'image/png');

      // Build public URL using the existing publicUrl helper (R2_PUBLIC_BASE_URL + key)
      const publicUrl = this.storage.publicUrl(imageKey);

      sharedImage = {
        r2Key: imageKey,
        url: publicUrl,
        mimeType: imageResult.mimeType,
      };

      // Attach the same image to all generated network posts
      for (const net of Object.keys(generatedPosts) as SocialNetwork[]) {
        if (generatedPosts[net]) {
          generatedPosts[net]!.image = sharedImage;
        }
      }

      this.logger.info('SocialMediaGenerationProcessor image generated', {
        traceId,
        imageKey,
      });
    } catch (imgErr) {
      this.logger.warn('SocialMediaGenerationProcessor image generation failed (non-fatal)', {
        traceId,
        error: imgErr instanceof Error ? imgErr.message : String(imgErr),
      });
    }

    // 2. Persist using rich Aggregate (Full Hex/DDD)
    const aggregate = SocialMediaGenerationAggregate.create({
      userId: actorId,
      niche: topicTitle,
      topicTitle,
      topicDescription,
      language,
      networks: activeNetworks.reduce(
        (acc, n) => ({ ...acc, [n]: true }),
        {} as Record<SocialNetwork, boolean>,
      ),
      generatedPosts,
    });

    const saved = await this.repo.save(aggregate);

    // 3. Upload history JSON to R2 (best effort, outside the core mutation)
    let r2Key: string | undefined;
    try {
      const historyPayload = {
        id: saved.id,
        generatedAt: saved.createdAt.toISOString(),
        topic: { title: topicTitle, description: topicDescription },
        networks: activeNetworks.reduce((acc, n) => ({ ...acc, [n]: true }), {} as Record<SocialNetwork, boolean>),
        posts: generatedPosts,
        language,
        hasImage: !!sharedImage,
      };
      const buffer = Buffer.from(JSON.stringify(historyPayload, null, 2), 'utf8');
      r2Key = `social-media/posts/${actorId}/${saved.id}.json`;
      await this.storage.upload(r2Key, buffer, 'application/json');
    } catch (e) {
      this.logger.warn('SocialMediaGenerationProcessor R2 upload failed (non-fatal)', {
        traceId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // 4. Audit (strict) — must succeed or the mutation is considered failed
    await this.audit.log(
      {
        action: 'social-media.post.generated',
        actorId,
        resourceId: saved.id,
        resourceType: 'SOCIAL_MEDIA',
        metadata: {
          topic: topicTitle,
          networks: activeNetworks,
          language,
        },
      },
      { strict: true },
    );

    // 5. Invalidate list cache so GET /social-media reflects the new item
    await this.cache.delByPattern(SOCIAL_MEDIA_CACHE_PATTERN);

    // 6. Domain event LAST (after save + audit + cache per Canonical Mutation Pattern)
    this.eventEmitter.emit(
      'social-media.generation.created',
      new SocialMediaGenerationCreatedEvent(
        saved.id,
        saved.userId,
        saved.topicTitle,
        Object.keys(saved.networks).filter((k) => saved.networks[k as SocialNetwork]),
        !!sharedImage,
        language,
      ),
    );

    this.logger.info('SocialMediaGenerationProcessor completed', {
      traceId,
      jobId: job.id,
      generationId: saved.id,
    });

    return {
      id: saved.id,
      r2Key,
    };
  }
}
