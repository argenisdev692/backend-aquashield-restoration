import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetCampaignExportStatusQuery } from '../get-campaign-export-status.query';
import { CAMPAIGN_GENERATION_REPOSITORY } from '../../../domain/ports/campaign-generation.repository.port';
import type { ICampaignGenerationRepository } from '../../../domain/ports/campaign-generation.repository.port';
import { CampaignGenerationNotFoundException } from '../../../domain/exceptions/campaign-domain.exception';
import type { CampaignExportStatusResponse } from '../../dtos/campaign-export-response.dto';
import { StageExportResult } from '../../../domain/value-objects/stage-export-result.vo';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@QueryHandler(GetCampaignExportStatusQuery)
@Injectable()
export class GetCampaignExportStatusHandler implements IQueryHandler<GetCampaignExportStatusQuery> {
  constructor(
    @Inject(CAMPAIGN_GENERATION_REPOSITORY)
    private readonly campaignRepo: ICampaignGenerationRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetCampaignExportStatusHandler.name);
  }

  async execute(
    query: GetCampaignExportStatusQuery,
  ): Promise<CampaignExportStatusResponse> {
    const traceId = this.cls.get<string>('traceId');
    const { generationId, actorId } = query;

    this.logger.info('GetCampaignExportStatusHandler', {
      traceId,
      generationId,
      actorId,
    });

    const aggregate = await this.campaignRepo.findById(generationId);

    if (!aggregate) {
      throw new CampaignGenerationNotFoundException(generationId);
    }

    // Ownership check (defense in depth — CASL also gates at controller)
    if (aggregate.userId !== actorId) {
      throw new CampaignGenerationNotFoundException(generationId);
    }

    const response: CampaignExportStatusResponse = {
      id: generationId,
      userId: aggregate.userId,
      companyName: aggregate.companyNameSnapshot,
      niche: aggregate.niche,
      location: aggregate.location,
      phone: aggregate.phone,
      website: aggregate.website,
      stages: [...aggregate.stages],
      format: aggregate.format,
      durationSeconds: aggregate.durationSeconds,
      language: aggregate.language,
      generateImages: aggregate.generateImages,
      aiObservations: aggregate.aiObservations,
      viralityScore: aggregate.viralityScore,
      roiScore: aggregate.roiScore,
      aiDetectionScore: aggregate.aiDetectionScore,
      analysisReportKey: aggregate.analysisReportKey,
      analysisReportUrl: aggregate.analysisReportUrl,
      status: aggregate.status,
      errorMessage: aggregate.errorMessage,
      stageExports: aggregate.stageResults.map((r: StageExportResult) => ({
        stage: r.stage,
        zipKey: r.zipKey,
        zipUrl: r.zipUrl,
        sizeBytes: r.sizeBytes,
        error: r.error,
        hasAudio: false,
        hasImages: false,
      })),
      createdAt: aggregate.createdAt.toISOString(),
      updatedAt: aggregate.updatedAt.toISOString(),
    };

    this.logger.info('GetCampaignExportStatusHandler completed', {
      traceId,
      generationId,
      status: response.status,
    });

    return response;
  }
}
