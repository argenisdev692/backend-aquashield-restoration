import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import PDFDocument from 'pdfkit';
import { LoggerService } from '../../../../logger/logger.service';
import { StorageService } from '../../../../shared/storage/storage.service';
import { QUEUE_NAMES } from '../../../../shared/messaging/queues.constants';

import type { ICampaignGenerationRepository } from '../../domain/ports/campaign-generation.repository.port';
import { CAMPAIGN_GENERATION_REPOSITORY } from '../../domain/ports/campaign-generation.repository.port';

import type { IStageExportGeneratorPort } from '../../domain/ports/stage-export-generator.port';
import { STAGE_EXPORT_GENERATOR_PORT } from '../../domain/ports/stage-export-generator.port';

import type { IAudioGeneratorPort } from '../../domain/ports/audio-generator.port';
import { AUDIO_GENERATOR_PORT } from '../../domain/ports/audio-generator.port';

import type { IImageGeneratorPort } from '../../domain/ports/image-generator.port';
import { IMAGE_GENERATOR_PORT } from '../../domain/ports/image-generator.port';

import type { IPdfBuilderPort } from '../../domain/ports/pdf-builder.port';
import { PDF_BUILDER_PORT } from '../../domain/ports/pdf-builder.port';

import type { IZipPackerPort } from '../../domain/ports/zip-packer.port';
import { ZIP_PACKER_PORT } from '../../domain/ports/zip-packer.port';

import type { IViralityResearchPort } from '../../domain/ports/virality-research.port';
import { VIRALITY_RESEARCH_PORT } from '../../domain/ports/virality-research.port';

import type { IAiDetectionPort } from '../../domain/ports/ai-detection.port';
import { AI_DETECTION_PORT } from '../../domain/ports/ai-detection.port';

import { CampaignGeneration } from '../../domain/entities/campaign-generation.aggregate';
import type { AiDetectionScore } from '../../domain/entities/campaign-generation.aggregate';
import { StageExportResult } from '../../domain/value-objects/stage-export-result.vo';
import { FunnelStageVO } from '../../domain/value-objects/funnel-stage.vo';
import { CampaignStageExportReadyEvent } from '../../domain/events/campaign-stage-export-ready.event';
import { CampaignExportCompletedEvent } from '../../domain/events/campaign-export-completed.event';
import type { ViralityResearchResult } from '../../domain/ports/virality-research.port';

export interface CampaignExportJobData {
  generationId: string;
  userId: string;
  payload: {
    companyDataId: string;
    companyNameSnapshot: string; // immutable display name resolved at request time
    niche: string;
    location: string;
    city?: string;
    state?: string;
    country?: string;
    phone: string;
    website?: string;
    stages: string[];
    format: '9:16' | '16:9' | 'both';
    durationSeconds: 15 | 20;
    language: string;
    generateImages: boolean;
    aiObservations?: string;
  };
}

/**
 * BullMQ Worker for the Campaigns export pipeline.
 *
 * This is the heart of the heavy asynchronous work:
 * - Per-stage Gemini content generation (scripts + scenes + production notes)
 * - Optional ElevenLabs TTS (Rachel, 9:16 + 16:9)
 * - Optional Gemini scene images
 * - pdfkit production brief
 * - archiver in-memory ZIP
 * - R2 upload via StorageService
 * - Status + stage result persistence
 * - Domain events for WebSocket real-time updates
 *
 * All external calls must be wrapped with resilience policies (cockatiel)
 * inside the concrete adapter implementations.
 */
@Injectable()
@Processor(QUEUE_NAMES.CAMPAIGN_EXPORT, { concurrency: 2 })
export class CampaignExportProcessor extends WorkerHost {
  constructor(
    @Inject(CAMPAIGN_GENERATION_REPOSITORY)
    private readonly campaignRepo: ICampaignGenerationRepository,

    @Inject(STAGE_EXPORT_GENERATOR_PORT)
    private readonly stageGenerator: IStageExportGeneratorPort,

    @Inject(PDF_BUILDER_PORT)
    private readonly pdfBuilder: IPdfBuilderPort,

    @Inject(ZIP_PACKER_PORT)
    private readonly zipPacker: IZipPackerPort,

    @Inject(VIRALITY_RESEARCH_PORT)
    private readonly viralityResearch: IViralityResearchPort,

    @Inject(AI_DETECTION_PORT)
    private readonly aiDetection: IAiDetectionPort,

    private readonly storage: StorageService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,

    @Optional()
    @Inject(AUDIO_GENERATOR_PORT)
    private readonly audioGenerator?: IAudioGeneratorPort,

    @Optional()
    @Inject(IMAGE_GENERATOR_PORT)
    private readonly imageGenerator?: IImageGeneratorPort,
  ) {
    super();
    this.logger.setContext(CampaignExportProcessor.name);
  }

  private buildAnalysisReport(input: {
    generationId: string;
    companyName: string;
    niche: string;
    location: string;
    city?: string;
    state?: string;
    country?: string;
    phone: string;
    website?: string;
    stages: string[];
    format: string;
    durationSeconds: number;
    language: string;
    generateImages: boolean;
    aiObservations?: string;
    viralityScore: number | null;
    roiScore: number | null;
    aiDetectionScore: AiDetectionScore | null;
    stageResults: StageExportResult[];
    viralityResult: ViralityResearchResult | null;
  }): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ─── Header ──────────────────────────────────────────────
      doc.fontSize(22).font('Helvetica-Bold').text('Campaign Analysis Report', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').fillColor('#64748b')
        .text(`Generated: ${new Date().toISOString()}`, { align: 'center' })
        .fillColor('#000');
      doc.moveDown(0.5);

      doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#e2e8f0').stroke();
      doc.moveDown(0.8);

      // ─── Company Info ────────────────────────────────────────
      doc.fontSize(14).font('Helvetica-Bold').text('Company Information');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Company: ${input.companyName}`);
      doc.text(`Niche: ${input.niche}`);
      doc.text(`Location: ${input.location}`);
      if (input.city || input.state || input.country) {
        const geo = [input.city, input.state, input.country].filter(Boolean).join(', ');
        doc.text(`Geo: ${geo}`);
      }
      doc.text(`Phone: ${input.phone}`);
      if (input.website) doc.text(`Website: ${input.website}`);
      doc.moveDown(0.5);

      // ─── Campaign Config ─────────────────────────────────────
      doc.fontSize(14).font('Helvetica-Bold').text('Campaign Configuration');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Format: ${input.format}  ·  Duration: ${input.durationSeconds}s  ·  Language: ${input.language}`);
      doc.text(`Stages: ${input.stages.join(' → ')}`);
      doc.text(`Generate Images: ${input.generateImages ? 'Yes' : 'No'}`);
      if (input.aiObservations) {
        doc.moveDown(0.2);
        doc.font('Helvetica-Bold').text('AI Observations:');
        doc.font('Helvetica').text(input.aiObservations, { width: 500 });
      }
      doc.moveDown(0.5);

      // ─── Scores ──────────────────────────────────────────────
      doc.fontSize(14).font('Helvetica-Bold').text('Performance Scores');
      doc.moveDown(0.4);

      const vScore = input.viralityScore ?? 0;
      const vColor = vScore >= 70 ? '#16a34a' : vScore >= 40 ? '#ca8a04' : '#dc2626';
      doc.fontSize(10).font('Helvetica-Bold').text('Virality Score');
      doc.font('Helvetica').fillColor(vColor).text(`${vScore}/100`, { indent: 20 }).fillColor('#000');
      doc.moveDown(0.2);

      const rScore = input.roiScore ?? 0;
      const rColor = rScore >= 70 ? '#16a34a' : rScore >= 40 ? '#ca8a04' : '#dc2626';
      doc.font('Helvetica-Bold').text('ROI Score');
      doc.font('Helvetica').fillColor(rColor).text(`${rScore}/100`, { indent: 20 }).fillColor('#000');
      doc.moveDown(0.2);

      if (input.aiDetectionScore) {
        const ai = input.aiDetectionScore;
        doc.font('Helvetica-Bold').text('AI Detection Breakdown');
        doc.font('Helvetica').text(`  Human Written: ${ai.humanWritten}%`, { indent: 20 });
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

      // ─── Similar Campaigns ───────────────────────────────────
      if (input.viralityResult?.similarCampaigns?.length) {
        doc.fontSize(14).font('Helvetica-Bold').text('Similar Campaigns Found');
        doc.moveDown(0.3);
        for (const c of input.viralityResult.similarCampaigns) {
          doc.fontSize(10).font('Helvetica-Bold').text(c.title);
          doc.font('Helvetica').fontSize(9).fillColor('#64748b')
            .text(`Engagement: ${c.engagementEstimate}  ·  ${c.url}`)
            .fillColor('#000');
          doc.fontSize(9).text(c.snippet, { indent: 10 });
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

      // ─── Stage Results ───────────────────────────────────────
      doc.fontSize(14).font('Helvetica-Bold').text('Stage Export Results');
      doc.moveDown(0.3);
      for (const sr of input.stageResults) {
        const status = sr.isSuccess() ? '✓ SUCCESS' : '✗ FAILED';
        const statusColor = sr.isSuccess() ? '#16a34a' : '#dc2626';
        doc.fontSize(10).font('Helvetica-Bold').text(`${sr.stage}`);
        doc.font('Helvetica').fillColor(statusColor).text(`  ${status}`, { indent: 20 }).fillColor('#000');
        if (sr.zipUrl) {
          doc.fontSize(8).fillColor('#64748b').text(`  ${sr.zipUrl}`, { indent: 20 }).fillColor('#000');
        }
        if (sr.error) {
          doc.fontSize(9).fillColor('#dc2626').text(`  Error: ${sr.error}`, { indent: 20 }).fillColor('#000');
        }
        doc.moveDown(0.15);
      }

      // ─── Footer ──────────────────────────────────────────────
      doc.moveDown(1);
      doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#e2e8f0').stroke();
      doc.moveDown(0.5);
      doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
        .text(`Generation ID: ${input.generationId}  ·  Vidula Campaign Engine`, { align: 'center' })
        .fillColor('#000');

      doc.end();
    });
  }

  async process(job: Job<CampaignExportJobData>): Promise<void> {
    const { generationId, userId, payload } = job.data;
    const traceId = this.cls.get<string>('traceId') ?? job.id ?? generationId;

    this.logger.info('CampaignExportProcessor start', {
      traceId,
      jobId: job.id,
      generationId,
      userId,
      stages: payload.stages,
    });

    // 1. Load aggregate and mark as processing
    const aggregate = await this.campaignRepo.findById(generationId);
    if (!aggregate) {
      this.logger.error('Campaign generation not found for processing', { traceId, generationId });
      return;
    }

    try {
      aggregate.markProcessing();
      await this.campaignRepo.save(aggregate);

      // 2. Virality Research (Tavily) — real-time trend analysis
      this.logger.info('Running virality research', { traceId, generationId });
      let viralityResult;
      try {
        viralityResult = await this.viralityResearch.research({
          niche: payload.niche,
          location: payload.location,
          city: payload.city,
          state: payload.state,
          country: payload.country,
          language: payload.language,
          aiObservations: payload.aiObservations ?? null,
        });
        aggregate.setViralityScore(viralityResult.score);
        aggregate.setRoiScore(viralityResult.roiScore);
        await this.campaignRepo.save(aggregate);
        this.logger.info('Virality research completed', {
          traceId,
          generationId,
          score: viralityResult.score,
          topics: viralityResult.trendingTopics.length,
        });
      } catch (researchErr) {
        this.logger.warn('Virality research failed, continuing without it', {
          traceId,
          generationId,
          error: researchErr instanceof Error ? researchErr.message : String(researchErr),
        });
        viralityResult = null;
      }

      const stageResults: StageExportResult[] = [];
      const errors: Record<string, string> = {};

      // 3. Process each stage (sequential for cost control + predictability)
      for (const rawStage of payload.stages) {
        const validatedStage = FunnelStageVO.fromString(rawStage).value;

        try {
          this.logger.info('Processing campaign stage', { traceId, generationId, stage: validatedStage });

          // 3.1 Generate creative content (Gemini) with aiObservations + virality recommendations
          const content = await this.stageGenerator.generate({
            companyName: payload.companyNameSnapshot,
            niche: payload.niche,
            location: payload.location,
            phone: payload.phone,
            website: payload.website,
            stage: validatedStage,
            format: payload.format,
            durationSeconds: payload.durationSeconds,
            language: payload.language,
            generateImages: payload.generateImages,
            aiObservations: payload.aiObservations ?? null,
            viralityRecommendations: viralityResult?.recommendations,
          });

          // 3.1b AI Detection check — verify content passes as human-written
          const combinedNarration = [
            content.scripts.vertical_916.narration,
            content.scripts.horizontal_169.narration,
          ].join(' ');

          let detectionScore;
          try {
            detectionScore = await this.aiDetection.analyze({
              text: combinedNarration,
              language: payload.language,
            });
            aggregate.setAiDetectionScore(detectionScore);
            await this.campaignRepo.save(aggregate);

            this.logger.info('AI detection analysis completed', {
              traceId,
              generationId,
              stage: validatedStage,
              humanWritten: detectionScore.humanWritten,
              showsAiSigns: detectionScore.showsAiSigns,
              aiGenerated: detectionScore.aiGenerated,
              aiParaphrased: detectionScore.aiParaphrased,
            });

            // Quality gate: warn if content looks too AI-generated
            if (detectionScore.showsAiSigns > 50 || detectionScore.humanWritten < 40) {
              this.logger.warn('Content flagged as likely AI-generated', {
                traceId,
                generationId,
                stage: validatedStage,
                detectionScore,
              });
            }
          } catch (detectionErr) {
            this.logger.warn('AI detection failed, continuing without it', {
              traceId,
              generationId,
              stage: validatedStage,
              error: detectionErr instanceof Error ? detectionErr.message : String(detectionErr),
            });
            detectionScore = null;
          }

          // 2.2 Optional audio (ElevenLabs) — parallel for both formats if needed
          let audio916: Buffer | null = null;
          let audio169: Buffer | null = null;

          if (this.audioGenerator?.isEnabled()) {
            const [a916, a169] = await Promise.allSettled([
              this.audioGenerator.generate({ text: content.scripts.vertical_916.narration, language: payload.language }),
              this.audioGenerator.generate({ text: content.scripts.horizontal_169.narration, language: payload.language }),
            ]);
            audio916 = a916.status === 'fulfilled' ? a916.value : null;
            audio169 = a169.status === 'fulfilled' ? a169.value : null;
          }

          // 2.3 Optional scene images (Gemini)
          const sceneImages = new Map<number, Buffer | null>();
          if (payload.generateImages && this.imageGenerator?.isEnabled()) {
            for (const scene of content.scenes) {
              const img = await this.imageGenerator.generate({
                niche: payload.niche,
                stage: validatedStage,
                scene,
                format: '9:16', // primary for now; can extend for both
              });
              sceneImages.set(scene.id, img);
            }
          }

          // 2.4 Build production brief PDF
          const pdfBuffer = await this.pdfBuilder.build({
            generationId,
            companyName: payload.companyNameSnapshot,
            niche: payload.niche,
            stage: validatedStage,
            format: payload.format,
            durationSeconds: payload.durationSeconds,
            content,
            images: sceneImages,
            generateImages: payload.generateImages,
          });

          // 2.5 Build in-memory ZIP
          const zipInput = {
            stage: validatedStage,
            scripts: {
              vertical_916: content.scripts.vertical_916.narration,
              horizontal_169: content.scripts.horizontal_169.narration,
            },
            audios: {
              vertical_916: audio916,
              horizontal_169: audio169,
            },
            scenes: content.scenes.map((s) => ({
              id: s.id,
              description: `${s.title}\n${s.visualDescription}\nKeywords: ${s.imageKeywords.join(', ')}`,
              image: sceneImages.get(s.id) ?? null,
            })),
            productionBriefPdf: pdfBuffer,
          };

          const zipResult = await this.zipPacker.buildStageZip(zipInput);

          // 2.6 Upload to R2
          const zipKey = `campaign-exports/${generationId}/${validatedStage}/${validatedStage}_campaign.zip`;
          await this.storage.upload(zipKey, zipResult.buffer, 'application/zip');
          const zipUrl = this.storage.publicUrl(zipKey);

          // 2.7 Persist stage result
          const stageResult = StageExportResult.create({
            stage: validatedStage,
            zipKey,
            zipUrl,
            sizeBytes: zipResult.sizeBytes,
            error: null,
          });

          aggregate.attachStageResult(stageResult);
          stageResults.push(stageResult);

          // Emit real-time progress
          this.eventEmitter.emit(
            'campaign.stage.ready',
            new CampaignStageExportReadyEvent(generationId, validatedStage, zipUrl),
          );

          this.logger.info('Stage export completed', {
            traceId,
            generationId,
            stage: validatedStage,
            zipUrl,
          });
        } catch (stageError) {
          const errorMsg = stageError instanceof Error ? stageError.message : String(stageError);
          this.logger.error('Stage export failed', { traceId, generationId, stage: validatedStage, error: errorMsg });

          errors[validatedStage] = errorMsg;

          const failedResult = StageExportResult.create({
            stage: validatedStage,
            error: errorMsg,
          });
          aggregate.attachStageResult(failedResult);
        }
      }

      // 3. Generate Campaign Analysis Report PDF
      try {
        this.logger.info('Generating campaign analysis report', { traceId, generationId });
        const reportBuffer = await this.buildAnalysisReport({
          generationId,
          companyName: payload.companyNameSnapshot,
          niche: payload.niche,
          location: payload.location,
          city: payload.city,
          state: payload.state,
          country: payload.country,
          phone: payload.phone,
          website: payload.website,
          stages: payload.stages,
          format: payload.format,
          durationSeconds: payload.durationSeconds,
          language: payload.language,
          generateImages: payload.generateImages,
          aiObservations: payload.aiObservations,
          viralityScore: aggregate.viralityScore,
          roiScore: aggregate.roiScore,
          aiDetectionScore: aggregate.aiDetectionScore,
          stageResults,
          viralityResult,
        });

        const reportKey = `campaign-exports/${generationId}/campaign_analysis_report.pdf`;
        await this.storage.upload(reportKey, reportBuffer, 'application/pdf');
        const reportUrl = this.storage.publicUrl(reportKey);
        aggregate.setAnalysisReport(reportKey, reportUrl);
        await this.campaignRepo.save(aggregate);

        this.logger.info('Analysis report generated', { traceId, generationId, reportUrl });
      } catch (reportErr) {
        this.logger.warn('Failed to generate analysis report, continuing', {
          traceId,
          generationId,
          error: reportErr instanceof Error ? reportErr.message : String(reportErr),
        });
      }

      // 4. Finalize aggregate status
      aggregate.complete();
      await this.campaignRepo.save(aggregate);

      // Emit completion event for WebSocket + any other side effects
      this.eventEmitter.emit(
        'campaign.export.completed',
        new CampaignExportCompletedEvent(
          generationId,
          userId,
          aggregate.status as 'completed' | 'partial' | 'failed', // safe: complete() or fail() was just called
          aggregate.errorMessage ?? undefined,
        ),
      );

      this.logger.info('CampaignExportProcessor completed', {
        traceId,
        generationId,
        status: aggregate.status,
        stagesProcessed: stageResults.length,
        errors: Object.keys(errors).length,
      });
    } catch (error) {
      this.logger.error('CampaignExportProcessor fatal error', {
        traceId,
        generationId,
        error: error instanceof Error ? error.message : String(error),
      });

      try {
        aggregate.fail(error instanceof Error ? error.message : 'Unknown processing error');
        await this.campaignRepo.save(aggregate);

        this.eventEmitter.emit(
          'campaign.export.completed',
          new CampaignExportCompletedEvent(
            generationId,
            userId,
            'failed',
            aggregate.errorMessage ?? undefined,
          ),
        );
      } catch (saveErr) {
        this.logger.error('Failed to persist failure state', { traceId, generationId, saveErr });
      }
    }
  }
}
