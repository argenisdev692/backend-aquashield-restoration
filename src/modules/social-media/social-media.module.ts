import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';

// Domain
import { TOPIC_FINDER_PORT } from './domain/ports/topic-finder.port';
import { POST_GENERATOR_PORT } from './domain/ports/post-generator.port';
import { IMAGE_GENERATOR_PORT } from './domain/ports/image-generator.port';
import { SOCIAL_MEDIA_REPOSITORY } from './domain/ports/social-media-repository.port';
import { SOCIAL_MEDIA_JOB_PORT } from './domain/ports/social-media-job.port';
import { VIRALITY_RESEARCH_PORT } from './domain/ports/virality-research.port';
import { AI_DETECTION_PORT } from './domain/ports/ai-detection.port';

// Application - Commands
import { GeneratePostCommand } from './application/commands/generate-post.command';
import { GeneratePostHandler } from './application/commands/handlers/generate-post.handler';
import { DeleteSocialMediaCommand } from './application/commands/delete-social-media.command';
import { DeleteSocialMediaHandler } from './application/commands/handlers/delete-social-media.handler';
import { BulkDeleteSocialMediaCommand } from './application/commands/bulk-delete-social-media.command';
import { BulkDeleteSocialMediaHandler } from './application/commands/handlers/bulk-delete-social-media.handler';
import { ExportSocialMediaCommand } from './application/commands/export-social-media.command';
import { ExportSocialMediaHandler } from './application/commands/handlers/export-social-media.handler';

// Application - Queries
import { FindTopicsQuery } from './application/queries/find-topics.query';
import { FindTopicsHandler } from './application/queries/handlers/find-topics.handler';
import { GetSocialMediaByIdQuery } from './application/queries/get-social-media-by-id.query';
import { GetSocialMediaByIdHandler } from './application/queries/handlers/get-social-media-by-id.handler';
import { ListSocialMediaQuery } from './application/queries/list-social-media.query';
import { ListSocialMediaHandler } from './application/queries/handlers/list-social-media.handler';

// Infrastructure - Adapters
import { TavilyTopicFinderAdapter } from './infrastructure/adapters/tavily-topic-finder.adapter';
import { GeminiPostGeneratorAdapter } from './infrastructure/adapters/gemini-post-generator.adapter';
import { GeminiImageGeneratorAdapter } from './infrastructure/adapters/gemini-image-generator.adapter';
import { TavilyViralityResearchAdapter } from './infrastructure/adapters/tavily-virality-research.adapter';
import { StubAiDetectionAdapter } from './infrastructure/adapters/stub/stub-ai-detection.adapter';

// Infrastructure - Jobs (BullMQ)
import { SocialMediaGenerationProcessor } from './infrastructure/jobs/social-media-generation.processor';
import { SocialMediaJobAdapter } from './infrastructure/jobs/social-media-job.adapter';

// Infrastructure - Persistence
import { PrismaSocialMediaRepository } from './infrastructure/persistence/repositories/prisma-social-media.repository';

// Infrastructure - API
import { SocialMediaController } from './infrastructure/api/controllers/social-media.controller';

// Infrastructure - Event Listeners
import { SocialMediaGenerationCreatedListener } from './infrastructure/event-listeners/social-media-generation-created.listener';

// Infrastructure - Gateways
import { SocialMediaGateway } from './infrastructure/gateways/social-media.gateway';
import { WsJwtMiddleware } from '../../shared/websockets/ws-jwt.middleware';

// Shared
import { StorageModule } from '../../shared/storage/storage.module';
import { QUEUE_NAMES } from '../../shared/messaging/queues.constants';

const CommandHandlers = [
  GeneratePostHandler,
  DeleteSocialMediaHandler,
  BulkDeleteSocialMediaHandler,
  ExportSocialMediaHandler,
];

const QueryHandlers = [
  FindTopicsHandler,
  GetSocialMediaByIdHandler,
  ListSocialMediaHandler,
];

@Module({
  imports: [
    CqrsModule,
    JwtModule.register({}),
    StorageModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.SOCIAL_MEDIA_GENERATION,
    }),
  ],
  controllers: [SocialMediaController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,

    // BullMQ Processor (the actual worker that runs Gemini + R2 + audit)
    SocialMediaGenerationProcessor,

    // Domain Event Listeners (Full Hex/DDD)
    SocialMediaGenerationCreatedListener,

    // WebSocket Gateway
    SocialMediaGateway,
    WsJwtMiddleware,

    // Port bindings
    {
      provide: TOPIC_FINDER_PORT,
      useClass: TavilyTopicFinderAdapter,
    },
    {
      provide: POST_GENERATOR_PORT,
      useClass: GeminiPostGeneratorAdapter,
    },
    {
      provide: SOCIAL_MEDIA_REPOSITORY,
      useClass: PrismaSocialMediaRepository,
    },
    {
      provide: SOCIAL_MEDIA_JOB_PORT,
      useClass: SocialMediaJobAdapter,
    },
    {
      provide: IMAGE_GENERATOR_PORT,
      useClass: GeminiImageGeneratorAdapter,
    },
    {
      provide: VIRALITY_RESEARCH_PORT,
      useClass: TavilyViralityResearchAdapter,
    },
    {
      provide: AI_DETECTION_PORT,
      useClass: StubAiDetectionAdapter,
    },
  ],
  exports: [SOCIAL_MEDIA_REPOSITORY],
})
export class SocialMediaModule {}
