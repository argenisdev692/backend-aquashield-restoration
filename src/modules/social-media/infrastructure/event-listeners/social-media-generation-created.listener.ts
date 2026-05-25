import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { SocialMediaGenerationCreatedEvent } from '../../domain/events/social-media-generation-created.event';

/**
 * Example @OnEvent listener for Full Hex/DDD.
 * Listens to domain events emitted AFTER the canonical mutation (save + audit + cache).
 * Can be used for secondary side effects: notifications, webhooks, analytics, etc.
 * Must NEVER contain business logic that should live in the Aggregate or CommandHandler.
 */
@Injectable()
export class SocialMediaGenerationCreatedListener {
  constructor(
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
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
    });

    // Example future side effects (commented — add real ones when needed):
    // - Send push notification to user
    // - Increment analytics counter
    // - Trigger webhook to external system
    // - Fan-out to WebSocket rooms via a gateway
  }
}
