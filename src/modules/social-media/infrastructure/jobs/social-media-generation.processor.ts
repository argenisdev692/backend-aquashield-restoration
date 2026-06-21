import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { EventEmitter2 } from '@nestjs/event-emitter';
import PDFDocument from 'pdfkit';
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
import {
  STORAGE_PORT,
  type IStoragePort,
} from '../../../../shared/storage/storage.port';
import { QUEUE_NAMES } from '../../../../shared/messaging/queues.constants';
import type {
  SocialNetwork,
  GeneratedPost,
  GeneratedPostImage,
  SocialMediaGeneration,
} from '../../domain/entities/social-media-generation.entity';
import { SocialMediaGenerationAggregate } from '../../domain/entities/social-media-generation.aggregate';
import type { AiDetectionScore } from '../../domain/entities/social-media-generation.aggregate';
import { SocialMediaGenerationCreatedEvent } from '../../domain/events/social-media-generation-created.event';
import {
  CACHE_PORT,
  type ICachePort,
} from '../../../../shared/cache/cache.port';
import { SOCIAL_MEDIA_CACHE_PATTERN } from '../../application/social-media-cache.constants';
import { SocialMediaGateway } from '../gateways/social-media.gateway';
import { VIRALITY_RESEARCH_PORT } from '../../domain/ports/virality-research.port';
import type { IViralityResearchPort } from '../../domain/ports/virality-research.port';
import type { ViralityResearchResult } from '../../domain/ports/virality-research.port';
import { AI_DETECTION_PORT } from '../../domain/ports/ai-detection.port';
import type { IAiDetectionPort } from '../../domain/ports/ai-detection.port';
import {
  TRANSACTION_MANAGER,
  type ITransactionManager,
} from '../../../../shared/database/transaction-manager.port';
import { CompanyBrandingService } from '../../../companydata/company-branding.service';

// Score thresholds from AI MODULES prompt
const SCORE_THRESHOLDS = {
  human_writing_index: 75,
  virality_score: 70,
  engagement_score: 70,
  roi_score: 70,
  trend_alignment: 70,
} as const;

const MAX_ITERATIONS = 5;

function identifyWeaknesses(
  scores: import('../../domain/ports/post-generator.port').ScoreEvaluation,
): Array<{
  score: string;
  current: number;
  target: number;
  gap: number;
  explanation: string;
}> {
  const weaknesses: Array<{
    score: string;
    current: number;
    target: number;
    gap: number;
    explanation: string;
  }> = [];

  for (const [key, threshold] of Object.entries(SCORE_THRESHOLDS)) {
    const current = scores[key as keyof typeof scores] ?? 0;
    if (current < threshold) {
      let explanation = '';
      switch (key) {
        case 'human_writing_index':
          explanation =
            'El contenido suena demasiado generado por IA. Añade anécdotas personales, lenguaje más natural y variación en la estructura de oraciones.';
          break;
        case 'virality_score':
          explanation =
            'El hook no es suficientemente fuerte. Mejora el inicio con algo más impactante o controversial.';
          break;
        case 'engagement_score':
          explanation =
            'Falta un call-to-action claro. Añade una pregunta o invitación a comentar.';
          break;
        case 'roi_score':
          explanation =
            'El contenido no tiene suficiente valor comercial. Añade beneficios claros o demostración de expertise.';
          break;
        case 'trend_alignment':
          explanation =
            'El contenido no está alineado con tendencias actuales. Incorpora temas más relevantes del momento.';
          break;
      }
      weaknesses.push({
        score: key,
        current,
        target: threshold,
        gap: threshold - current,
        explanation,
      });
    }
  }

  return weaknesses;
}

function calculateOverallScore(
  scores: import('../../domain/ports/post-generator.port').ScoreEvaluation,
): number {
  const values = Object.values(scores);
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function allScoresPass(
  scores: import('../../domain/ports/post-generator.port').ScoreEvaluation,
): boolean {
  return Object.entries(SCORE_THRESHOLDS).every(
    ([key, threshold]) =>
      (scores[key as keyof typeof scores] ?? 0) >= threshold,
  );
}

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
    @Inject(VIRALITY_RESEARCH_PORT)
    private readonly viralityResearch: IViralityResearchPort,
    @Inject(AI_DETECTION_PORT)
    private readonly aiDetection: IAiDetectionPort,
    @Inject(STORAGE_PORT)
    private readonly storage: IStoragePort,
    @Inject(TRANSACTION_MANAGER)
    private readonly tx: ITransactionManager,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly gateway: SocialMediaGateway,
    private readonly branding: CompanyBrandingService,
  ) {
    super();
    this.logger.setContext(SocialMediaGenerationProcessor.name);
  }

  private buildAnalysisReport(input: {
    generationId: string;
    niche: string;
    topicTitle: string;
    topicDescription: string | null;
    language: string | null;
    networks: SocialNetwork[];
    generatedPosts: Partial<Record<SocialNetwork, GeneratedPost>>;
    viralityScore: number | null;
    roiScore: number | null;
    aiDetectionScore: AiDetectionScore | null;
    viralityResult: ViralityResearchResult | null;
  }): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ─── Header ──────────────────────────────────────────────
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('Social Media Analysis Report', { align: 'center' });
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(`Generated: ${new Date().toISOString()}`, { align: 'center' })
        .fillColor('#000');
      doc.moveDown(0.5);

      doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#e2e8f0').stroke();
      doc.moveDown(0.8);

      // ─── Topic Info ───────────────────────────────────────────
      doc.fontSize(14).font('Helvetica-Bold').text('Topic Information');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Niche: ${input.niche}`);
      doc.text(`Topic: ${input.topicTitle}`);
      if (input.topicDescription) {
        doc.text(`Description: ${input.topicDescription}`, { width: 500 });
      }
      if (input.language) doc.text(`Language: ${input.language}`);
      doc.text(`Networks: ${input.networks.join(', ')}`);
      doc.moveDown(0.5);

      // ─── Scores ──────────────────────────────────────────────
      doc.fontSize(14).font('Helvetica-Bold').text('Performance Scores');
      doc.moveDown(0.4);

      const vScore = input.viralityScore ?? 0;
      const vColor =
        vScore >= 70 ? '#16a34a' : vScore >= 40 ? '#ca8a04' : '#dc2626';
      doc.fontSize(10).font('Helvetica-Bold').text('Virality Score');
      doc
        .font('Helvetica')
        .fillColor(vColor)
        .text(`${vScore}/100`, { indent: 20 })
        .fillColor('#000');
      doc.moveDown(0.2);

      const rScore = input.roiScore ?? 0;
      const rColor =
        rScore >= 70 ? '#16a34a' : rScore >= 40 ? '#ca8a04' : '#dc2626';
      doc.font('Helvetica-Bold').text('ROI Score');
      doc
        .font('Helvetica')
        .fillColor(rColor)
        .text(`${rScore}/100`, { indent: 20 })
        .fillColor('#000');
      doc.moveDown(0.2);

      if (input.aiDetectionScore) {
        const ai = input.aiDetectionScore;
        doc.font('Helvetica-Bold').text('AI Detection Breakdown');
        doc
          .font('Helvetica')
          .text(`  Human Written: ${ai.humanWritten}%`, { indent: 20 });
        doc.text(`  Shows AI Signs: ${ai.showsAiSigns}%`, { indent: 20 });
        doc.text(`  AI Generated: ${ai.aiGenerated}%`, { indent: 20 });
        doc.text(`  AI Paraphrased: ${ai.aiParaphrased}%`, { indent: 20 });
      }
      doc.moveDown(0.5);

      // ─── Lead Metrics ────────────────────────────────────────
      if (input.viralityResult?.leadMetrics) {
        const lm = input.viralityResult.leadMetrics;
        doc.fontSize(14).font('Helvetica-Bold').text('Lead Generation Metrics');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Estimated CPL: $${lm.estimatedCpl.toFixed(2)}`);
        doc.text(`Estimated Conversion Rate: ${lm.estimatedConversionRate}%`);
        doc.text(`Market Size: ${lm.marketSize}`);
        doc.text(`Competitiveness: ${lm.competitiveness}`);
        doc.text(`Projected Leads/Month: ${lm.projectedLeadsPerMonth}`);
        doc.moveDown(0.5);
      }

      // ─── Trending Topics ─────────────────────────────────────
      if (input.viralityResult?.trendingTopics?.length) {
        doc.fontSize(14).font('Helvetica-Bold').text('Trending Topics');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        for (const topic of input.viralityResult.trendingTopics) {
          doc.text(`• ${topic}`, { indent: 10 });
        }
        doc.moveDown(0.5);
      }

      // ─── Similar Posts ───────────────────────────────────────
      if (input.viralityResult?.similarPosts?.length) {
        doc.fontSize(14).font('Helvetica-Bold').text('Similar Posts Found');
        doc.moveDown(0.3);
        for (const p of input.viralityResult.similarPosts) {
          doc.fontSize(10).font('Helvetica-Bold').text(p.title);
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#64748b')
            .text(`Engagement: ${p.engagementEstimate}  ·  ${p.url}`)
            .fillColor('#000');
          doc.fontSize(9).text(p.snippet, { indent: 10 });
          doc.moveDown(0.2);
        }
        doc.moveDown(0.3);
      }

      // ─── Recommendations ─────────────────────────────────────
      if (input.viralityResult?.recommendations?.length) {
        doc.fontSize(14).font('Helvetica-Bold').text('AI Recommendations');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        for (const rec of input.viralityResult.recommendations) {
          doc.text(`• ${rec}`, { indent: 10 });
        }
        doc.moveDown(0.5);
      }

      // ─── Generated Posts ─────────────────────────────────────
      doc.fontSize(14).font('Helvetica-Bold').text('Generated Posts');
      doc.moveDown(0.3);
      for (const [network, post] of Object.entries(input.generatedPosts)) {
        if (post) {
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(`${network.toUpperCase()}`);
          doc
            .font('Helvetica')
            .fontSize(9)
            .text(
              `  Body: ${post.body.substring(0, 200)}${post.body.length > 200 ? '...' : ''}`,
              { indent: 10 },
            );
          if (post.hashtags?.length) {
            doc.text(`  Hashtags: ${post.hashtags.join(', ')}`, { indent: 10 });
          }
          if (post.hook) {
            doc.text(`  Hook: ${post.hook}`, { indent: 10 });
          }
          if (post.image?.url) {
            doc.text(`  Image: ${post.image.url}`, { indent: 10 });
          }
          doc.moveDown(0.15);
        }
      }

      // ─── Footer ──────────────────────────────────────────────
      doc.moveDown(1);
      doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#e2e8f0').stroke();
      doc.moveDown(0.5);
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text(
          `Generation ID: ${input.generationId}  ·  ${this.branding.getFallbackName()} Social Media Engine`,
          { align: 'center' },
        )
        .fillColor('#000');

      doc.end();
    });
  }

  async process(
    job: Job<SocialMediaGenerationJobData>,
  ): Promise<SocialMediaGenerationJobResult> {
    const {
      actorId,
      topicTitle,
      topicDescription,
      activeNetworks,
      language = 'es',
    } = job.data;
    const traceId = this.cls.get<string>('traceId') ?? job.id;

    this.logger.info('SocialMediaGenerationProcessor start', {
      traceId,
      jobId: job.id,
      actorId,
      networks: activeNetworks,
    });

    try {
      return await this.doProcess(job);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error('SocialMediaGenerationProcessor failed', {
        traceId,
        jobId: job.id,
        error: errorMessage,
      });

      this.gateway.broadcastGenerationFailed({
        userId: actorId,
        jobId: job.id as string,
        topicTitle,
        networks: activeNetworks,
        error: errorMessage,
      });

      throw err;
    }
  }

  private async doProcess(
    job: Job<SocialMediaGenerationJobData>,
  ): Promise<SocialMediaGenerationJobResult> {
    const {
      actorId,
      topicTitle,
      topicDescription,
      activeNetworks,
      language = 'es',
    } = job.data;
    const traceId = this.cls.get<string>('traceId') ?? job.id;

    // 1. Virality Research (Tavily) — real-time trend analysis
    this.logger.info('Running virality research', { traceId, topicTitle });
    let viralityResult: ViralityResearchResult | null = null;
    try {
      viralityResult = await this.viralityResearch.research({
        niche: topicTitle,
        topicTitle,
        topicDescription: topicDescription || null,
        language,
      });
      this.logger.info('Virality research completed', {
        traceId,
        score: viralityResult.score,
        roiScore: viralityResult.roiScore,
        topics: viralityResult.trendingTopics.length,
      });
    } catch (researchErr) {
      this.logger.warn('Virality research failed, continuing without it', {
        traceId,
        error:
          researchErr instanceof Error
            ? researchErr.message
            : String(researchErr),
      });
      viralityResult = null;
    }

    // 2. Generate posts via Gemini with quality loop (max 5 iterations)
    let bestGeneratedPosts: Partial<Record<SocialNetwork, GeneratedPost>> = {};
    let bestScores: import('../../domain/ports/post-generator.port').ScoreEvaluation =
      {
        human_writing_index: 0,
        virality_score: 0,
        engagement_score: 0,
        roi_score: 0,
        trend_alignment: 0,
      };
    let bestAiDetectionRisk = 100;
    let bestOverallScore = 0;
    let iteration = 0;
    let qualityWarning = false;
    let previousScores:
      | import('../../domain/ports/post-generator.port').ScoreEvaluation
      | null = null;
    let previousWeaknesses: Array<{
      score: string;
      current: number;
      target: number;
      gap: number;
      explanation: string;
    }> = [];

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      this.logger.info('Quality loop iteration', {
        traceId,
        iteration,
        maxIterations: MAX_ITERATIONS,
      });

      const generationResult = await this.generator.generatePostsWithFeedback({
        topicTitle,
        topicDescription,
        activeNetworks,
        language,
        feedback:
          previousScores && previousWeaknesses.length > 0
            ? {
                iteration,
                previousScores,
                weaknesses: previousWeaknesses,
              }
            : undefined,
      });

      const { scores, ai_detection_risk, ...posts } = generationResult;
      const overallScore = calculateOverallScore(scores);
      const iterationPassed = allScoresPass(scores);

      this.logger.info('Generation iteration completed', {
        traceId,
        iteration,
        scores,
        ai_detection_risk,
        overallScore,
      });

      // Real-time progress to the user (UI shows "optimizing…" with partial scores)
      this.gateway.broadcastGenerationProgress({
        userId: actorId,
        jobId: job.id as string,
        topicTitle,
        iteration,
        maxIterations: MAX_ITERATIONS,
        scores,
        overallScore: Math.round(overallScore),
        allPassed: iterationPassed,
      });

      // Track best attempt
      if (overallScore > bestOverallScore) {
        bestOverallScore = overallScore;
        bestScores = scores;
        bestAiDetectionRisk = ai_detection_risk;
        bestGeneratedPosts = {};
        for (const net of activeNetworks) {
          const post = posts[net];
          if (post) {
            bestGeneratedPosts[net] = {
              body: post.body,
              hashtags: post.hashtags,
              ...(post.emojis ? { emojis: post.emojis } : {}),
              ...(post.hook ? { hook: post.hook } : {}),
            };
          }
        }
      }

      // Check if all scores pass thresholds
      if (iterationPassed) {
        this.logger.info('All scores pass thresholds', {
          traceId,
          iteration,
          scores,
        });
        qualityWarning = false;
        break;
      }

      // Prepare feedback for next iteration
      previousScores = scores;
      previousWeaknesses = identifyWeaknesses(scores);

      this.logger.info('Scores below thresholds, preparing next iteration', {
        traceId,
        iteration,
        weaknesses: previousWeaknesses,
      });

      if (iteration === MAX_ITERATIONS) {
        qualityWarning = true;
        this.logger.warn('Max iterations reached, using best attempt', {
          traceId,
          iteration,
          bestOverallScore,
        });
      }
    }

    const generatedPosts = bestGeneratedPosts;

    // 2.5 AI Detection check — verify content passes as human-written
    let aiDetectionScore: AiDetectionScore | null = null;
    try {
      const combinedText = Object.values(generatedPosts)
        .map((p) => p?.body || '')
        .join(' ');

      if (combinedText.length > 0) {
        aiDetectionScore = await this.aiDetection.analyze({
          text: combinedText,
          language,
        });
        this.logger.info('AI detection analysis completed', {
          traceId,
          humanWritten: aiDetectionScore.humanWritten,
          showsAiSigns: aiDetectionScore.showsAiSigns,
        });
      }
    } catch (detectionErr) {
      this.logger.warn('AI detection failed, continuing without it', {
        traceId,
        error:
          detectionErr instanceof Error
            ? detectionErr.message
            : String(detectionErr),
      });
      aiDetectionScore = null;
    }

    // 3. Image generation (Google Gen AI via shared IAiClient)
    // Best-effort: a failure here must never break the text post generation.
    let sharedImage: GeneratedPostImage | undefined;
    try {
      const imageResult = await this.imageGenerator.generateImage({
        prompt: `${topicTitle}. ${topicDescription}`,
        aspectRatio: '1:1',
      });

      const imageKey = `social-media/images/${actorId}/${Date.now()}.png`;
      const imageBuffer = Buffer.from(imageResult.base64, 'base64');

      await this.storage.upload(
        imageKey,
        imageBuffer,
        imageResult.mimeType || 'image/png',
      );

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
          generatedPosts[net].image = sharedImage;
        }
      }

      this.logger.info('SocialMediaGenerationProcessor image generated', {
        traceId,
        imageKey,
      });
    } catch (imgErr) {
      this.logger.warn(
        'SocialMediaGenerationProcessor image generation failed (non-fatal)',
        {
          traceId,
          error: imgErr instanceof Error ? imgErr.message : String(imgErr),
        },
      );
    }

    // 4. Persist using rich Aggregate (Full Hex/DDD)
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
      viralityScore: viralityResult?.score ?? null,
      roiScore: viralityResult?.roiScore ?? null,
      aiDetectionScore: aiDetectionScore ?? null,
      qualityScores: bestScores,
      qualityWarning,
      iterationsRequired: iteration,
    });

    // 5. Generate Analysis Report PDF (before transaction - upload happens outside tx)
    let reportKey: string | undefined;
    let reportUrl: string | undefined;
    try {
      this.logger.info('Generating social media analysis report', {
        traceId,
      });
      const reportBuffer = await this.buildAnalysisReport({
        generationId: aggregate.id,
        niche: aggregate.niche,
        topicTitle: aggregate.topicTitle,
        topicDescription: aggregate.topicDescription ?? null,
        language: aggregate.language ?? null,
        networks: activeNetworks,
        generatedPosts,
        viralityScore: aggregate.viralityScore ?? null,
        roiScore: aggregate.roiScore ?? null,
        aiDetectionScore: aggregate.aiDetectionScore ?? null,
        viralityResult,
      });

      reportKey = `social-media/analysis/${aggregate.id}/social_media_analysis_report.pdf`;
      await this.storage.upload(reportKey, reportBuffer, 'application/pdf');
      reportUrl = this.storage.publicUrl(reportKey);

      this.logger.info('Analysis report uploaded to R2', {
        traceId,
        reportKey,
      });
    } catch (reportErr) {
      this.logger.warn(
        'Failed to generate analysis report, continuing without it',
        {
          traceId,
          error:
            reportErr instanceof Error ? reportErr.message : String(reportErr),
        },
      );
    }

    // 6. Transactional write: save + update (with report) + audit (strict)
    let saved: SocialMediaGeneration;
    try {
      saved = await this.tx.runInTx(async () => {
        const savedAggregate = await this.repo.save(aggregate);

        // Update with analysis report if it was successfully uploaded
        if (reportKey && reportUrl) {
          aggregate.setAnalysisReport(reportKey, reportUrl);
          await this.repo.update(aggregate);
        }

        // Audit with strict mode - must succeed or transaction rolls back
        await this.audit.log(
          {
            action: 'social-media.post.generated',
            actorId,
            resourceId: savedAggregate.id,
            resourceType: 'SOCIAL_MEDIA',
            metadata: {
              topic: topicTitle,
              networks: activeNetworks,
              language,
              viralityScore: savedAggregate.viralityScore,
              roiScore: savedAggregate.roiScore,
            },
          },
          { strict: true },
        );

        return savedAggregate;
      });
    } catch (txErr) {
      // Best-effort cleanup: delete the freshly-uploaded report if transaction failed
      if (reportKey) {
        try {
          await this.storage.delete(reportKey);
          this.logger.warn(
            'Cleaned up analysis report after transaction failure',
            {
              traceId,
              reportKey,
            },
          );
        } catch (cleanupErr) {
          this.logger.error(
            'Failed to cleanup analysis report after transaction failure',
            {
              traceId,
              reportKey,
              error:
                cleanupErr instanceof Error
                  ? cleanupErr.message
                  : String(cleanupErr),
            },
          );
        }
      }
      throw txErr;
    }

    // 7. Upload history JSON to R2 (best effort, outside the core mutation)
    let r2Key: string | undefined;
    try {
      const historyPayload = {
        id: saved.id,
        generatedAt: saved.createdAt.toISOString(),
        topic: { title: topicTitle, description: topicDescription },
        networks: activeNetworks.reduce(
          (acc, n) => ({ ...acc, [n]: true }),
          {} as Record<SocialNetwork, boolean>,
        ),
        posts: generatedPosts,
        language,
        hasImage: !!sharedImage,
        viralityScore: saved.viralityScore,
        roiScore: saved.roiScore,
        aiDetectionScore: saved.aiDetectionScore,
        analysisReportUrl: saved.analysisReportUrl,
      };
      const buffer = Buffer.from(
        JSON.stringify(historyPayload, null, 2),
        'utf8',
      );
      r2Key = `social-media/posts/${actorId}/${saved.id}.json`;
      await this.storage.upload(r2Key, buffer, 'application/json');
    } catch (e) {
      this.logger.warn(
        'SocialMediaGenerationProcessor R2 upload failed (non-fatal)',
        {
          traceId,
          error: e instanceof Error ? e.message : String(e),
        },
      );
    }

    // 8. Invalidate list cache so GET /social-media reflects the new item
    await this.cache.delByPattern(SOCIAL_MEDIA_CACHE_PATTERN);

    // 9. Domain event LAST (after save + audit + cache per Canonical Mutation Pattern)
    this.eventEmitter.emit(
      'social-media.generation.created',
      new SocialMediaGenerationCreatedEvent(
        saved.id,
        saved.userId,
        saved.topicTitle,
        Object.keys(saved.networks).filter(
          (k) => saved.networks[k as SocialNetwork],
        ),
        !!sharedImage,
        language,
        saved.viralityScore ?? null,
        saved.roiScore ?? null,
        saved.aiDetectionScore ?? null,
        saved.analysisReportUrl ?? null,
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
