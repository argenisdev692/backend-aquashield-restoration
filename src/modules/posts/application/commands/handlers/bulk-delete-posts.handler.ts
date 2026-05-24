import { Injectable, Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { BulkDeletePostsCommand } from '../bulk-delete-posts.command';
import { POST_REPOSITORY } from '../../../domain/repositories/post-repository.interface';
import type { IPostRepository } from '../../../domain/repositories/post-repository.interface';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { PostsBulkDeletedEvent } from '../../../domain/events/posts-bulk-deleted.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { POSTS_CACHE_PATTERN } from '../../posts-cache.constants';

@Injectable()
@CommandHandler(BulkDeletePostsCommand)
export class BulkDeletePostsHandler implements ICommandHandler<BulkDeletePostsCommand> {
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
    this.logger.setContext(BulkDeletePostsHandler.name);
  }

  async execute(command: BulkDeletePostsCommand): Promise<{ count: number }> {
    const { ids } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BulkDeletePostsHandler start', {
      traceId,
      idsCount: ids.length,
    });

    const result = await this.persist(command);

    await this.cache.delByPattern(POSTS_CACHE_PATTERN);
    this.eventEmitter.emit(
      'posts.bulk_deleted',
      new PostsBulkDeletedEvent(ids),
    );

    this.logger.info('BulkDeletePostsHandler end', {
      traceId,
      count: result.count,
    });

    return result;
  }

  @Transactional()
  private async persist(command: BulkDeletePostsCommand): Promise<{ count: number }> {
    const { ids, actorId } = command;

    const result = await this.repo.bulkDelete(ids);

    await this.audit.log(
      {
        action: 'posts.bulk_deleted',
        actorId,
        resourceType: 'POST',
        resourceId: ids.length === 1 ? ids[0] : undefined,
        metadata: { ids, count: result.count },
      },
      { strict: true },
    );

    return result;
  }
}
