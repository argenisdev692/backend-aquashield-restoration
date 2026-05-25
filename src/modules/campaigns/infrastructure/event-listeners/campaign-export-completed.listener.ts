import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { CampaignsGateway } from '../gateways/campaigns.gateway';
import { CampaignExportCompletedEvent } from '../../domain/events/campaign-export-completed.event';

/**
 * Broadcasts final completion (or failure) of a campaign export to all
 * clients listening on the campaign room and the user room.
 */
@Injectable()
export class CampaignExportCompletedListener {
  constructor(
    private readonly gateway: CampaignsGateway,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(CampaignExportCompletedListener.name);
  }

  @OnEvent('campaign.export.completed', { async: true })
  async handle(event: CampaignExportCompletedEvent): Promise<void> {
    const traceId = this.cls.get<string>('traceId') ?? event.generationId;

    this.logger.info('CampaignExportCompletedListener broadcasting', {
      traceId,
      generationId: event.generationId,
      status: event.status,
      viralityScore: event.viralityScore,
      roiScore: event.roiScore,
      analysisReportUrl: event.analysisReportUrl,
    });

    if (event.status === 'failed') {
      this.gateway.broadcastExportFailed(event.generationId, event.errorMessage ?? 'Export failed');
    } else {
      this.gateway.broadcastExportCompleted(
        event.generationId,
        event.status,
        event.viralityScore,
        event.roiScore,
        event.aiDetectionScore,
        event.analysisReportUrl,
      );
    }

    // Also notify the owner personally
    this.gateway.broadcastToUser(event.userId, 'campaign:export:finished', {
      generationId: event.generationId,
      status: event.status,
      viralityScore: event.viralityScore,
      roiScore: event.roiScore,
      aiDetectionScore: event.aiDetectionScore,
      analysisReportUrl: event.analysisReportUrl,
    });
  }
}
