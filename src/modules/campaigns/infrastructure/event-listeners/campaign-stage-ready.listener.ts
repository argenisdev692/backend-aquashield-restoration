import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { CampaignsGateway } from '../gateways/campaigns.gateway';
import { CampaignStageExportReadyEvent } from '../../domain/events/campaign-stage-export-ready.event';

/**
 * Listens to stage completion events (emitted by the BullMQ processor)
 * and pushes real-time updates to connected WebSocket clients in the
 * campaign:${generationId} room.
 */
@Injectable()
export class CampaignStageReadyListener {
  constructor(
    private readonly gateway: CampaignsGateway,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(CampaignStageReadyListener.name);
  }

  @OnEvent('campaign.stage.ready', { async: true })
  async handle(event: CampaignStageExportReadyEvent): Promise<void> {
    const traceId = this.cls.get<string>('traceId') ?? event.generationId;

    this.logger.info('CampaignStageReadyListener broadcasting', {
      traceId,
      generationId: event.generationId,
      stage: event.stage,
    });

    this.gateway.broadcastStageReady(
      event.generationId,
      event.stage,
      event.zipUrl,
    );
  }
}
