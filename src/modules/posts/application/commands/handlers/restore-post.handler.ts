import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { RestorePostCommand } from '../restore-post.command';
import { POST_REPOSITORY } from '../../../domain/repositories/post-repository.interface';
import type { IPostRepository } from '../../../domain/repositories/post-repository.interface';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { PostRestoredEvent } from '../../../domain/events/post-restored.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { POSTS_CACHE_PATTERN } from '../../posts-cache.constants';

@Injectable()
@CommandHandler(RestorePostCommand)
export class RestorePostHandler implements ICommandHandler<RestorePostCommand> {
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
    this.logger.setContext(RestorePostHandler.name);
  }

  @Transactional()
  async execute(command: RestorePostCommand): Promise<void> {
    const { id } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RestorePostHandler start', { traceId, postId: id });

    await this.persist(command);

    await this.cache.delByPattern(POSTS_CACHE_PATTERN);
    this.eventEmitter.emit('post.restored', new PostRestoredEvent(id));

    this.logger.info('RestorePostHandler end', {
      traceId,
      postId: id,
    });
  }

  private async persist(command: RestorePostCommand): Promise<void> {
    const { id, actorId } = command;

    const post = await this.repo.findById(id, true); // true to find soft-deleted post
    if (!post) {
      throw new NotFoundException(`Post with id ${id} not found`);
    }

    await this.repo.restore(id);

    await this.audit.log(
      {
        action: 'posts.restored',
        actorId,
        resourceType: 'POST',
        resourceId: id,
      },
      { strict: true },
    );
  }
}
