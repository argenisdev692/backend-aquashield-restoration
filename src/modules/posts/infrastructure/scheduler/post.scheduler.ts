import { Injectable, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { POST_REPOSITORY } from '../../domain/repositories/post-repository.interface';
import type { IPostRepository } from '../../domain/repositories/post-repository.interface';
import { Post } from '../../domain/entities/post.aggregate';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../logger/logger.service';
import { POSTS_CACHE_PATTERN } from '../../application/posts-cache.constants';

@Injectable()
export class PostScheduler {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repo: IPostRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(PostScheduler.name);
  }

  @Cron('*/5 * * * *')
  async publishScheduledPosts(): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('PostScheduler.publishScheduledPosts start', { traceId });

    const duePosts = await this.repo.findScheduledDue();

    if (duePosts.length === 0) {
      this.logger.info('PostScheduler.publishScheduledPosts — no due posts', {
        traceId,
      });
      return;
    }

    let published = 0;
    for (const post of duePosts) {
      try {
        await this.publishOne(post);
        published += 1;
      } catch (err) {
        this.logger.error(
          'PostScheduler failed to auto-publish scheduled post',
          {
            traceId,
            postId: post.id.value,
            error: err instanceof Error ? err.message : String(err),
          },
        );
        // continue with remaining posts — one failure must not block the batch
      }
    }

    if (published > 0) {
      await this.cache.delByPattern(POSTS_CACHE_PATTERN);
    }

    this.logger.info('PostScheduler.publishScheduledPosts end', {
      traceId,
      published,
      total: duePosts.length,
    });
  }

  /**
   * Publishes one due scheduled post + persists the aggregate + writes a strict audit row.
   * Wrapped in @Transactional so the mutation and its audit succeed or fail atomically.
   * Any exception here will be caught by the caller and logged; the loop continues.
   */
  @Transactional()
  private async publishOne(post: Post): Promise<void> {
    const traceId = this.cls.get<string>('traceId');

    post.publish();
    await this.repo.save(post);

    await this.audit.log(
      {
        action: 'posts.auto_published',
        resourceType: 'POST',
        resourceId: post.id.value,
        metadata: { scheduledAt: post.scheduledAt },
      },
      { strict: true },
    );

    this.logger.info('PostScheduler auto-published scheduled post', {
      traceId,
      postId: post.id.value,
    });
  }
}
