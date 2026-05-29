import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { QUEUE_NAMES } from '../../../../shared/messaging/queues.constants';
import { StorageService } from '../../../../shared/storage/storage.service';
import {
  AI_CLIENT,
  type IAiClient,
} from '../../../../shared/external/ai/ai-client.port';
import {
  CACHE_PORT,
  type ICachePort,
} from '../../../../shared/cache/cache.port';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../../shared/activity-log/audit.port';
import {
  SOCIAL_POST_GENERATION_PORT,
  type SocialPostGenerationPort,
} from '../../domain/ports/social-post-generation.port';
import {
  RESEARCH_PORT,
  type ResearchPort,
} from '../../domain/ports/research.port';
import {
  SOCIAL_GENERATION_REPOSITORY,
  type ISocialGenerationRepository,
} from '../../domain/repositories/social-generation-repository.interface';
import {
  ResearchResult,
  type Source,
} from '../../domain/value-objects/research-result.vo';
import {
  SocialPostPackage,
  type PackageMetadata,
} from '../../domain/value-objects/social-post-package.vo';
import {
  evaluateScores,
  MAX_QUALITY_ITERATIONS,
  type SocialPostScores,
  type ScoreWeakness,
} from '../../domain/value-objects/social-post-scores.vo';
import {
  buildTavilyQueries,
  SOCIAL_POST_TTL_SECONDS,
  type SocialGenerationJobData,
  type SocialGenerationResult,
} from '../../application/social/social-generation.util';
import { PostsGateway } from '../gateways/posts.gateway';

@Injectable()
@Processor(QUEUE_NAMES.SOCIAL_MEDIA_GENERATION)
export class SocialPostGenerationProcessor extends WorkerHost {
  private readonly imageModel: string;

  constructor(
    @Inject(SOCIAL_POST_GENERATION_PORT)
    private readonly socialGeneration: SocialPostGenerationPort,
    @Inject(RESEARCH_PORT)
    private readonly research: ResearchPort,
    @Inject(AI_CLIENT)
    private readonly aiClient: IAiClient,
    @Inject(SOCIAL_GENERATION_REPOSITORY)
    private readonly repo: ISocialGenerationRepository,
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly gateway: PostsGateway,
  ) {
    super();
    this.logger.setContext(SocialPostGenerationProcessor.name);
    this.imageModel = this.config.get<string>(
      'GEMINI_IMAGE_MODEL',
      'gemini-2.0-flash-exp-image-generation',
    );
  }

  async process(
    job: Job<SocialGenerationJobData>,
  ): Promise<SocialGenerationResult> {
    const { userId } = job.data;
    const jobId = job.id as string;
    const traceId = this.cls.get<string>('traceId') ?? jobId;

    this.logger.info('SocialPostGenerationProcessor start', {
      traceId,
      jobId,
      title: job.data.idea.title,
    });

    try {
      const result = await this.doProcess(job);

      this.gateway.broadcastSocialCompleted({
        userId,
        jobId,
        generationId: result.id,
        iterations: result.pkg.metadata.iterationsRequired,
        qualityWarning: result.pkg.metadata.qualityWarning,
        overallAverage: evaluateScores(result.pkg.scores).overallAverage,
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error('SocialPostGenerationProcessor failed', {
        traceId,
        jobId,
        error,
      });
      this.gateway.broadcastSocialFailed({ userId, jobId, error });
      throw err;
    }
  }

  private async doProcess(
    job: Job<SocialGenerationJobData>,
  ): Promise<SocialGenerationResult> {
    const { idea, context, networks, cacheKey, userId } = job.data;
    const jobId = job.id as string;
    const traceId = this.cls.get<string>('traceId') ?? jobId;

    const loop = await this.runQualityLoop(job);
    let pkg = loop.best.withMetadata(loop.metadata);

    // Side-effect (R2) BEFORE the DB transaction — Postgres cannot un-upload.
    const prefix = `social-media/posts/${randomUUID()}`;
    const images = await this.generateImages(pkg, prefix, traceId);
    pkg = pkg.withImages(images.platformUrls, images.mainUrl);

    let id: string;
    try {
      id = await this.persist(
        userId,
        context.niche,
        idea.title,
        idea.angle,
        networks,
        pkg,
      );
    } catch (err) {
      // Best-effort cleanup of the freshly-uploaded blobs if the tx failed.
      await this.cleanupImages(images.uploadedKeys, traceId);
      throw err;
    }

    const result: SocialGenerationResult = { id, pkg };
    await this.cache.set(cacheKey, result, SOCIAL_POST_TTL_SECONDS);

    this.logger.info('SocialPostGenerationProcessor completed', {
      traceId,
      jobId,
      generationId: id,
      iterations: pkg.metadata.iterationsRequired,
      qualityWarning: pkg.metadata.qualityWarning,
    });

    return result;
  }

  private async runQualityLoop(job: Job<SocialGenerationJobData>): Promise<{
    best: SocialPostPackage;
    metadata: PackageMetadata;
  }> {
    const { idea, context, userId } = job.data;
    const jobId = job.id as string;
    const traceId = this.cls.get<string>('traceId') ?? jobId;

    let best: SocialPostPackage | null = null;
    let bestAverage = -1;
    let previousScores: SocialPostScores | null = null;
    let weaknesses: ScoreWeakness[] = [];
    let tavilySearches = 0;
    let iteration = 0;
    let qualityWarning = false;

    while (iteration < MAX_QUALITY_ITERATIONS) {
      iteration += 1;

      this.gateway.broadcastSocialProgress({
        userId,
        jobId,
        iteration,
        maxIterations: MAX_QUALITY_ITERATIONS,
        phase: 'research',
      });
      const queries = buildTavilyQueries(idea, context, iteration);
      const research = await this.researchForIteration(queries);
      tavilySearches += queries.length;

      this.gateway.broadcastSocialProgress({
        userId,
        jobId,
        iteration,
        maxIterations: MAX_QUALITY_ITERATIONS,
        phase: 'generation',
      });
      const pkg = await this.socialGeneration.generatePackage({
        idea,
        context,
        research,
        iteration,
        previousScores,
        weaknesses,
      });

      const evaluation = evaluateScores(pkg.scores);
      this.gateway.broadcastSocialProgress({
        userId,
        jobId,
        iteration,
        maxIterations: MAX_QUALITY_ITERATIONS,
        phase: 'scoring',
        overallAverage: evaluation.overallAverage,
        allPass: evaluation.allPass,
      });

      this.logger.info('SocialPostGenerationProcessor iteration scored', {
        traceId,
        jobId,
        iteration,
        overallAverage: evaluation.overallAverage,
        allPass: evaluation.allPass,
        failing: evaluation.failingScores,
      });

      if (evaluation.overallAverage > bestAverage) {
        bestAverage = evaluation.overallAverage;
        best = pkg;
      }

      if (evaluation.allPass) {
        break;
      }

      previousScores = pkg.scores;
      weaknesses = evaluation.weaknesses;

      if (iteration === MAX_QUALITY_ITERATIONS) {
        qualityWarning = true;
      }
    }

    // `best` is always set: the loop runs at least once and assigns on the
    // first iteration (overallAverage >= 0 > initial -1).
    const finalBest = best as SocialPostPackage;
    const metadata: PackageMetadata = {
      ...finalBest.metadata,
      iterationsRequired: iteration,
      qualityWarning,
      qualityWarningMessage: qualityWarning
        ? 'Maximum iterations reached. Showing best attempt.'
        : null,
      tavilySearchesPerformed: tavilySearches,
      aiGeneratedAt: new Date().toISOString(),
    };

    return { best: finalBest, metadata };
  }

  private async researchForIteration(
    queries: string[],
  ): Promise<ResearchResult> {
    const results = await Promise.all(
      queries.map((q) => this.research.research(q)),
    );

    const seen = new Set<string>();
    const sources: Source[] = [];
    for (const r of results) {
      for (const s of r.sources) {
        if (s.url && seen.has(s.url)) continue;
        if (s.url) seen.add(s.url);
        sources.push(s);
      }
    }
    sources.sort((a, b) => b.score - a.score);

    const summary = results
      .map((r) => r.summary)
      .filter((s) => s.length > 0)
      .join(' ');

    if (sources.length === 0 && summary.length === 0) {
      return ResearchResult.empty();
    }
    return new ResearchResult(sources.slice(0, 8), summary);
  }

  // ── Images (best-effort, R2) ───────────────────────────────────────────────

  private async generateImages(
    pkg: SocialPostPackage,
    prefix: string,
    traceId: string | undefined,
  ): Promise<{
    mainUrl: string | null;
    platformUrls: Record<string, string | null>;
    uploadedKeys: string[];
  }> {
    const platformUrls: Record<string, string | null> = {};
    const uploadedKeys: string[] = [];

    if (!this.aiClient.generateImage) {
      this.logger.warn(
        'SocialPostGenerationProcessor: AI client has no image support — skipping image generation',
        { traceId },
      );
      return { mainUrl: null, platformUrls, uploadedKeys };
    }

    const mainUrl = await this.generateOne(
      pkg.coverImage.mainPrompt,
      `${prefix}/main-cover.png`,
      uploadedKeys,
      traceId,
    );

    for (const variation of pkg.platformVariations) {
      platformUrls[variation.platform] = await this.generateOne(
        variation.imagePrompt,
        `${prefix}/${variation.platform}-cover.png`,
        uploadedKeys,
        traceId,
      );
    }

    return { mainUrl, platformUrls, uploadedKeys };
  }

  private async generateOne(
    prompt: string,
    key: string,
    uploadedKeys: string[],
    traceId: string | undefined,
  ): Promise<string | null> {
    if (!prompt || !this.aiClient.generateImage) return null;
    try {
      const image = await this.aiClient.generateImage({
        model: this.imageModel,
        prompt,
      });
      const buffer = Buffer.from(image.base64, 'base64');
      await this.storage.upload(key, buffer, image.mimeType);
      uploadedKeys.push(key);
      return this.storage.publicUrl(key);
    } catch (err) {
      this.logger.warn(
        'SocialPostGenerationProcessor image generation failed',
        {
          traceId,
          key,
          error: err instanceof Error ? err.message : String(err),
        },
      );
      return null;
    }
  }

  private async cleanupImages(
    keys: string[],
    traceId: string | undefined,
  ): Promise<void> {
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch (err) {
        this.logger.warn('SocialPostGenerationProcessor image cleanup failed', {
          traceId,
          key,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // ── Persistence (tx + strict audit) ─────────────────────────────────────────

  @Transactional()
  private async persist(
    userId: string,
    niche: string,
    topicTitle: string,
    topicDescription: string,
    networks: string[],
    pkg: SocialPostPackage,
  ): Promise<string> {
    const id = await this.repo.create({
      userId,
      niche,
      topicTitle,
      topicDescription,
      networks,
      pkg,
    });

    await this.audit.log(
      {
        action: 'posts.social_generated',
        actorId: userId,
        resourceType: 'SOCIAL_POST',
        resourceId: id,
        metadata: {
          niche,
          iterations: pkg.metadata.iterationsRequired,
          qualityWarning: pkg.metadata.qualityWarning,
          overallAverage: evaluateScores(pkg.scores).overallAverage,
        },
      },
      { strict: true },
    );

    return id;
  }
}
