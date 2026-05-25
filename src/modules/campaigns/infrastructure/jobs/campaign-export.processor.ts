import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
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

import { CampaignGeneration } from '../../domain/entities/campaign-generation.aggregate';
import { StageExportResult } from '../../domain/value-objects/stage-export-result.vo';
import { FunnelStageVO } from '../../domain/value-objects/funnel-stage.vo';
import { CampaignStageExportReadyEvent } from '../../domain/events/campaign-stage-export-ready.event';
import { CampaignExportCompletedEvent } from '../../domain/events/campaign-export-completed.event';

export interface CampaignExportJobData {
  generationId: string;
  userId: string;
  payload: {
    companyDataId: string;
    companyNameSnapshot: string; // immutable display name resolved at request time
    niche: string;
    location: string;
    phone: string;
    website?: string;
    stages: string[];
    format: '9:16' | '16:9' | 'both';
    durationSeconds: 15 | 20;
    language: string;
    generateImages: boolean;
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

      const stageResults: StageExportResult[] = [];
      const errors: Record<string, string> = {};

      // 2. Process each stage (sequential for cost control + predictability)
      for (const rawStage of payload.stages) {
        const validatedStage = FunnelStageVO.fromString(rawStage).value;

        try {
          this.logger.info('Processing campaign stage', { traceId, generationId, stage: validatedStage });

          // 2.1 Generate creative content (Gemini)
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
          });

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

      // 3. Finalize aggregate status
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
