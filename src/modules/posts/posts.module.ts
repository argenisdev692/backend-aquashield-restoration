import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';
import { PostsController } from './infrastructure/api/controllers/posts.controller';
import { QUEUE_NAMES } from '../../shared/messaging/queues.constants';
import { AiPostGenerationProcessor } from './infrastructure/jobs/ai-post-generation.processor';

// Command Handlers
import { CreatePostHandler } from './application/commands/handlers/create-post.handler';
import { UpdatePostHandler } from './application/commands/handlers/update-post.handler';
import { DeletePostHandler } from './application/commands/handlers/delete-post.handler';
import { RestorePostHandler } from './application/commands/handlers/restore-post.handler';
import { BulkDeletePostsHandler } from './application/commands/handlers/bulk-delete-posts.handler';
import { BulkRestorePostsHandler } from './application/commands/handlers/bulk-restore-posts.handler';
import { GeneratePostPreviewHandler } from './application/commands/handlers/generate-post-preview.handler';

// Query Handlers
import { GetPostByIdHandler } from './application/queries/handlers/get-post-by-id.handler';
import { GetPostsListHandler } from './application/queries/handlers/get-posts-list.handler';
import { ExportPostsHandler } from './application/queries/handlers/export-posts.handler';

// Repository & Ports
import { PrismaPostRepository } from './infrastructure/persistence/repositories/prisma-post.repository';
import { POST_REPOSITORY } from './domain/repositories/post-repository.interface';
import { AUDIT_PORT } from '../../shared/activity-log/audit.port';
import { ActivityLogService } from '../../shared/activity-log/activity-log.service';

// AI Generation
import { AI_POST_GENERATION_PORT } from './domain/ports/ai-post-generation.port';
import { GeminiPostGenerationAdapter } from './infrastructure/external/ai/gemini-post-generation.adapter';

// Research (Tavily for E-E-A-T grounding)
import { RESEARCH_PORT } from './domain/ports/research.port';
import { TavilyResearchAdapter } from './infrastructure/external/tavily/tavily-research.adapter';

// Shared
import { StorageModule } from '../../shared/storage/storage.module';

// Event Listeners
import { PostEventListener } from './infrastructure/event-listeners/post-event.listener';

// Scheduler
import { PostScheduler } from './infrastructure/scheduler/post.scheduler';

// WebSocket Gateway
import { PostsGateway } from './infrastructure/gateways/posts.gateway';

@Module({
  controllers: [PostsController],
  imports: [
    CqrsModule,
    StorageModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.AI_GENERATION,
    }),
  ],
  providers: [
    CreatePostHandler,
    UpdatePostHandler,
    DeletePostHandler,
    RestorePostHandler,
    BulkDeletePostsHandler,
    BulkRestorePostsHandler,
    GeneratePostPreviewHandler,
    GetPostByIdHandler,
    GetPostsListHandler,
    ExportPostsHandler,
    { provide: POST_REPOSITORY, useClass: PrismaPostRepository },
    ActivityLogService,
    { provide: AUDIT_PORT, useExisting: ActivityLogService },
    {
      provide: AI_POST_GENERATION_PORT,
      useClass: GeminiPostGenerationAdapter,
    },
    {
      provide: RESEARCH_PORT,
      useClass: TavilyResearchAdapter,
    },
    PostEventListener,
    PostScheduler,
    AiPostGenerationProcessor,
    PostsGateway,
  ],
})
export class PostsModule {}
