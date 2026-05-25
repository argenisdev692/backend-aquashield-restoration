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
import { AI_POST_GENERATION_PORT } from '../../../domain/ports/ai-post-generation.port';
import type { AiPostGenerationPort } from '../../../domain/ports/ai-post-generation.port';
import { Post } from '../../../domain/entities/post.aggregate';
import { PostCreatedEvent } from '../../../domain/events/post-created.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { POSTS_CACHE_PATTERN } from '../../posts-cache.constants';
import {
  sanitizeRichContent,
  sanitizePlainText,
} from '../../../../../shared/utils/content-sanitizer';

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
    @Inject(AI_POST_GENERATION_PORT)
    private readonly aiGeneration: AiPostGenerationPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext(CreatePostHandler.name);
  }

  @Transactional()
  async execute(command: CreatePostCommand): Promise<string> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CreatePostHandler start', { traceId });

    const { dto } = command;

    if (dto.generateWithAi) {
      this.logger.info('CreatePostHandler AI generation requested', {
        traceId,
        topic: dto.postTitle,
        niche: dto.aiNiche,
      });

      const preview = await this.aiGeneration.generatePreview(
        dto.postTitle,
        dto.aiNiche || 'industry insights',
        dto.aiWordCount || 1200,
      );

      dto.postContent = preview.postContent;
      dto.postTitleSlug = dto.postTitleSlug || preview.postTitleSlug;
      dto.postExcerpt = dto.postExcerpt || preview.postExcerpt;
      dto.metaTitle = dto.metaTitle || preview.metaTitle;
      dto.metaDescription = dto.metaDescription || preview.metaDescription;
      dto.metaKeywords = dto.metaKeywords || preview.metaKeywords;

      if (!dto.postCoverImage && preview.generatedImageUrl) {
        dto.postCoverImage = preview.generatedImageUrl;
      }

      this.logger.info('CreatePostHandler AI generation completed', {
        traceId,
        hasImage: !!preview.generatedImageUrl,
        sources: preview.sources.length,
      });
    }

    const id = await this.persist(command);

    await this.cache.delByPattern(POSTS_CACHE_PATTERN);

    this.eventEmitter.emit(
      'post.created',
      new PostCreatedEvent(id, command.actorId),
    );

    this.logger.info('CreatePostHandler end', {
      traceId,
      postId: id,
    });

    return id;
  }

  private async persist(command: CreatePostCommand): Promise<string> {
    const { dto, actorId } = command;
    const traceId = this.cls.get<string>('traceId');

    // Server-side sanitization (OWASP) for both manual and AI-generated content.
    // Rich Markdown/HTML is allowed only in postContent via a strict allowlist.
    // All other text fields are stripped of HTML entirely.
    const post = Post.create({
      postTitle: sanitizePlainText(dto.postTitle),
      postTitleSlug: dto.postTitleSlug ? sanitizePlainText(dto.postTitleSlug) : undefined,
      postContent: sanitizeRichContent(dto.postContent),
      postExcerpt: dto.postExcerpt ? sanitizePlainText(dto.postExcerpt) : null,
      postCoverImage: dto.postCoverImage,
      metaTitle: dto.metaTitle ? sanitizePlainText(dto.metaTitle) : null,
      metaDescription: dto.metaDescription ? sanitizePlainText(dto.metaDescription) : null,
      metaKeywords: dto.metaKeywords ? sanitizePlainText(dto.metaKeywords) : null,
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
