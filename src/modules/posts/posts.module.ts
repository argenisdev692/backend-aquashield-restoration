import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PostsController } from './infrastructure/api/controllers/posts.controller';

// Command Handlers
import { CreatePostHandler } from './application/commands/handlers/create-post.handler';
import { UpdatePostHandler } from './application/commands/handlers/update-post.handler';
import { DeletePostHandler } from './application/commands/handlers/delete-post.handler';
import { RestorePostHandler } from './application/commands/handlers/restore-post.handler';
import { BulkDeletePostsHandler } from './application/commands/handlers/bulk-delete-posts.handler';
import { BulkRestorePostsHandler } from './application/commands/handlers/bulk-restore-posts.handler';

// Query Handlers
import { GetPostByIdHandler } from './application/queries/handlers/get-post-by-id.handler';
import { GetPostsListHandler } from './application/queries/handlers/get-posts-list.handler';
import { ExportPostsHandler } from './application/queries/handlers/export-posts.handler';

// Repository & Ports
import { PrismaPostRepository } from './infrastructure/persistence/repositories/prisma-post.repository';
import { POST_REPOSITORY } from './domain/repositories/post-repository.interface';
import { AUDIT_PORT } from '../../shared/activity-log/audit.port';
import { ActivityLogService } from '../../shared/activity-log/activity-log.service';

// Event Listeners
import { PostEventListener } from './infrastructure/event-listeners/post-event.listener';

// Scheduler
import { PostScheduler } from './infrastructure/scheduler/post.scheduler';

@Module({
  controllers: [PostsController],
  imports: [CqrsModule],
  providers: [
    CreatePostHandler,
    UpdatePostHandler,
    DeletePostHandler,
    RestorePostHandler,
    BulkDeletePostsHandler,
    BulkRestorePostsHandler,
    GetPostByIdHandler,
    GetPostsListHandler,
    ExportPostsHandler,
    { provide: POST_REPOSITORY, useClass: PrismaPostRepository },
    { provide: AUDIT_PORT, useExisting: ActivityLogService },
    PostEventListener,
    PostScheduler,
  ],
})
export class PostsModule {}
