import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { SocialMediaGenerationCreatedEvent } from '../../domain/events/social-media-generation-created.event';
import { SocialMediaGateway } from '../gateways/social-media.gateway';

@Injectable()
export class SocialMediaGenerationCreatedListener {
  constructor(
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly gateway: SocialMediaGateway,
  ) {
    this.logger.setContext(SocialMediaGenerationCreatedListener.name);
  }

  @OnEvent('social-media.generation.created')
  handle(event: SocialMediaGenerationCreatedEvent): void {
    const traceId = this.cls.get<string>('traceId') ?? 'no-trace';

    this.logger.info('SocialMediaGenerationCreatedListener received event', {
      traceId,
      generationId: event.generationId,
      userId: event.userId,
      networks: event.networks,
      hasImage: event.hasImage,
      language: event.language,
      viralityScore: event.viralityScore,
      roiScore: event.roiScore,
      analysisReportUrl: event.analysisReportUrl,
    });

    this.gateway.broadcastGenerationCompleted({
      userId: event.userId,
      generationId: event.generationId,
      topicTitle: event.topicTitle,
      networks: event.networks,
      hasImage: event.hasImage,
      language: event.language,
      viralityScore: event.viralityScore,
      roiScore: event.roiScore,
      aiDetectionScore: event.aiDetectionScore,
      analysisReportUrl: event.analysisReportUrl,
    });
  }
}
