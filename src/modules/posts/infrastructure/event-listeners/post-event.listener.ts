import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { PostCreatedEvent } from '../../domain/events/post-created.domain-event';
import { PostUpdatedEvent } from '../../domain/events/post-updated.domain-event';
import { PostDeletedEvent } from '../../domain/events/post-deleted.domain-event';
import { PostRestoredEvent } from '../../domain/events/post-restored.domain-event';
import { PostsBulkDeletedEvent } from '../../domain/events/posts-bulk-deleted.domain-event';
import { PostsBulkRestoredEvent } from '../../domain/events/posts-bulk-restored.domain-event';

@Injectable()
export class PostEventListener {
  constructor(
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(PostEventListener.name);
  }

  @OnEvent('post.created')
  handlePostCreated(event: PostCreatedEvent): void {
    this.logger.info('Post created event received', {
      traceId: this.cls.get<string>('traceId'),
      postId: event.postId,
    });
  }

  @OnEvent('post.updated')
  handlePostUpdated(event: PostUpdatedEvent): void {
    this.logger.info('Post updated event received', {
      traceId: this.cls.get<string>('traceId'),
      postId: event.postId,
    });
  }

  @OnEvent('post.deleted')
  handlePostDeleted(event: PostDeletedEvent): void {
    this.logger.info('Post deleted event received', {
      traceId: this.cls.get<string>('traceId'),
      postId: event.postId,
    });
  }

  @OnEvent('post.restored')
  handlePostRestored(event: PostRestoredEvent): void {
    this.logger.info('Post restored event received', {
      traceId: this.cls.get<string>('traceId'),
      postId: event.postId,
    });
  }

  @OnEvent('posts.bulk_deleted')
  handlePostsBulkDeleted(event: PostsBulkDeletedEvent): void {
    this.logger.info('Posts bulk deleted event received', {
      traceId: this.cls.get<string>('traceId'),
      postIdsCount: event.postIds.length,
    });
  }

  @OnEvent('posts.bulk_restored')
  handlePostsBulkRestored(event: PostsBulkRestoredEvent): void {
    this.logger.info('Posts bulk restored event received', {
      traceId: this.cls.get<string>('traceId'),
      postIdsCount: event.postIds.length,
    });
  }
}
