import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { UpdatePostCommand } from '../update-post.command';
import { POST_REPOSITORY } from '../../../domain/repositories/post-repository.interface';
import type { IPostRepository } from '../../../domain/repositories/post-repository.interface';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { PostUpdatedEvent } from '../../../domain/events/post-updated.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { POSTS_CACHE_PATTERN } from '../../posts-cache.constants';
import {
  sanitizeRichContent,
  sanitizePlainText,
} from '../../../../../shared/utils/content-sanitizer';

@Injectable()
@CommandHandler(UpdatePostCommand)
export class UpdatePostHandler implements ICommandHandler<UpdatePostCommand> {
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
    this.logger.setContext(UpdatePostHandler.name);
  }

  @Transactional()
  async execute(command: UpdatePostCommand): Promise<void> {
    const { id } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('UpdatePostHandler start', { traceId, postId: id });

    await this.persist(command);

    await this.cache.delByPattern(POSTS_CACHE_PATTERN);

    this.eventEmitter.emit(
      'post.updated',
      new PostUpdatedEvent(id),
    );

    this.logger.info('UpdatePostHandler end', {
      traceId,
      postId: id,
    });
  }

  private async persist(command: UpdatePostCommand): Promise<void> {
    const { id, dto, actorId } = command;

    const post = await this.repo.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with id ${id} not found`);
    }

    // Server-side sanitization on every update (same rules as create).
    post.updateDetails({
      postTitle: dto.postTitle ? sanitizePlainText(dto.postTitle) : undefined,
      postTitleSlug: dto.postTitleSlug ? sanitizePlainText(dto.postTitleSlug) : undefined,
      postContent: dto.postContent ? sanitizeRichContent(dto.postContent) : undefined,
      postExcerpt: dto.postExcerpt !== undefined ? sanitizePlainText(dto.postExcerpt) : undefined,
      postCoverImage: dto.postCoverImage,
      metaTitle: dto.metaTitle !== undefined ? sanitizePlainText(dto.metaTitle) : undefined,
      metaDescription: dto.metaDescription !== undefined ? sanitizePlainText(dto.metaDescription) : undefined,
      metaKeywords: dto.metaKeywords !== undefined ? sanitizePlainText(dto.metaKeywords) : undefined,
      categoryId: dto.categoryId,
      postStatus: dto.postStatus,
      scheduledAt: dto.scheduledAt,
    });

    await this.repo.save(post);

    await this.audit.log(
      {
        action: 'posts.updated',
        actorId,
        resourceType: 'POST',
        resourceId: id,
      },
      { strict: true },
    );
  }
}
