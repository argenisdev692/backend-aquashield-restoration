import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetPostsListQuery } from '../get-posts-list.query';
import { POST_REPOSITORY } from '../../../domain/repositories/post-repository.interface';
import type {
  IPostRepository,
  PostFilters,
  PaginatedResult,
  PostReadModel,
} from '../../../domain/repositories/post-repository.interface';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { resolveTrashedMode } from '../../../../../shared/crud/trashed.util';

@Injectable()
@QueryHandler(GetPostsListQuery)
export class GetPostsListHandler implements IQueryHandler<GetPostsListQuery> {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repo: IPostRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetPostsListHandler.name);
  }

  async execute(
    query: GetPostsListQuery,
  ): Promise<PaginatedResult<PostReadModel>> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetPostsListHandler', { traceId });

    const filters: PostFilters = {
      categoryId: query.filters.categoryId,
      userId: query.filters.userId,
      postStatus: query.filters.postStatus,
      search: query.filters.search,
      page: query.filters.page,
      limit: query.filters.limit,
      trashed: resolveTrashedMode({
        withTrashed: query.filters.withTrashed,
        onlyTrashed: query.filters.onlyTrashed,
      }),
    };

    return this.repo.findAll(filters);
  }
}
