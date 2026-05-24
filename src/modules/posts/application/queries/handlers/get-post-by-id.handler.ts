import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetPostByIdQuery } from '../get-post-by-id.query';
import { POST_REPOSITORY } from '../../../domain/repositories/post-repository.interface';
import type {
  IPostRepository,
  PostReadModel,
} from '../../../domain/repositories/post-repository.interface';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
@QueryHandler(GetPostByIdQuery)
export class GetPostByIdHandler implements IQueryHandler<GetPostByIdQuery> {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repo: IPostRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetPostByIdHandler.name);
  }

  async execute(query: GetPostByIdQuery): Promise<PostReadModel> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetPostByIdHandler', {
      traceId,
      postId: query.id,
      withTrashed: query.withTrashed,
    });
    const post = await this.repo.findReadModelById(
      query.id,
      query.withTrashed,
    );
    if (!post) {
      throw new NotFoundException(`Post ${query.id} not found`);
    }
    return post;
  }
}
