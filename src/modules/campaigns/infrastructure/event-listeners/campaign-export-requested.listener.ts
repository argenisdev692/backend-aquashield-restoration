import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { QUEUE_NAMES } from '../../../../shared/messaging/queues.constants';
import { CampaignExportRequestedEvent } from '../../domain/events/campaign-export-requested.event';

/**
 * Listens to the domain event fired by RequestCampaignExportUseCase.
 * Immediately enqueues the heavy export generation job into BullMQ.
 *
 * This listener is the bridge between the synchronous request acceptance
 * (UseCase + audit) and the asynchronous AI + asset pipeline.
 */
@Injectable()
export class CampaignExportRequestedListener {
  constructor(
    @InjectQueue(QUEUE_NAMES.CAMPAIGN_EXPORT)
    private readonly campaignExportQueue: Queue,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(CampaignExportRequestedListener.name);
  }

  @OnEvent('campaign.export.requested', { async: true })
  async handle(event: CampaignExportRequestedEvent): Promise<void> {
    const traceId = this.cls.get<string>('traceId') ?? event.generationId;

    this.logger.info('CampaignExportRequestedListener received event', {
      traceId,
      generationId: event.generationId,
      userId: event.userId,
      stages: event.payload.stages,
    });

    // Enqueue the job. Use generationId as jobId for idempotency (safe retries).
    await this.campaignExportQueue.add(
      'process-campaign-export',
      {
        generationId: event.generationId,
        userId: event.userId,
        payload: event.payload,
      },
      {
        jobId: `campaign-export:${event.generationId}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60_000, // 1 minute between retries
        },
        removeOnComplete: 100, // keep last 100 completed for debugging
        removeOnFail: false,   // keep failures for inspection
      },
    );

    this.logger.info('Campaign export job enqueued', {
      traceId,
      generationId: event.generationId,
    });
  }
}
