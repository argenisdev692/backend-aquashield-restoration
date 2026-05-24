import { Injectable, Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { CreatePostCommand } from '../create-post.command';
import { POST_REPOSITORY } from '../../../domain/repositories/post-repository.interface';
import type { IPostRepository } from '../../../domain/repositories/post-repository.interface';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { Post } from '../../../domain/entities/post.aggregate';
import { PostCreatedEvent } from '../../../domain/events/post-created.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { POSTS_CACHE_PATTERN } from '../../posts-cache.constants';

@Injectable()
@CommandHandler(CreatePostCommand)
export class CreatePostHandler implements ICommandHandler<CreatePostCommand> {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repo: IPostRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext(CreatePostHandler.name);
  }

  async execute(command: CreatePostCommand): Promise<string> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CreatePostHandler start', { traceId });

    const id = await this.persist(command);

    await this.cache.delByPattern(POSTS_CACHE_PATTERN);

    this.eventEmitter.emit(
      'post.created',
      new PostCreatedEvent(id),
    );

    this.logger.info('CreatePostHandler end', {
      traceId,
      postId: id,
    });

    return id;
  }

  @Transactional()
  private async persist(command: CreatePostCommand): Promise<string> {
    const { dto, actorId } = command;
    const traceId = this.cls.get<string>('traceId');

    const post = Post.create({
      postTitle: dto.postTitle,
      postTitleSlug: dto.postTitleSlug,
      postContent: dto.postContent,
      postExcerpt: dto.postExcerpt,
      postCoverImage: dto.postCoverImage,
      metaTitle: dto.metaTitle,
      metaDescription: dto.metaDescription,
      metaKeywords: dto.metaKeywords,
      categoryId: dto.categoryId,
      userId: actorId, // Set the creator/user ID
      postStatus: dto.postStatus,
      scheduledAt: dto.scheduledAt,
    });

    await this.repo.save(post);

    await this.audit.log(
      {
        action: 'posts.created',
        actorId,
        resourceType: 'POST',
        resourceId: post.id.value,
      },
      { strict: true },
    );

    return post.id.value;
  }
}
