import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { GetPostsListHandler } from '../../../application/queries/handlers/get-posts-list.handler';
import { GetPostsListQuery } from '../../../application/queries/get-posts-list.query';
import {
  POST_REPOSITORY,
  type IPostRepository,
} from '../../../domain/repositories/post-repository.interface';
import { LoggerService } from '../../../../../logger/logger.service';
import type { PostFiltersInput } from '../../../application/dtos/post-filters.dto';

describe('GetPostsListHandler', () => {
  let handler: GetPostsListHandler;
  let mockRepo: jest.Mocked<IPostRepository>;

  const baseFilters: PostFiltersInput = {
    page: 1,
    limit: 20,
  };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn(),
      findReadModelById: jest.fn(),
      findIdBySlug: jest.fn(),
      findAll: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
      save: jest.fn(),
      delete: jest.fn(),
      restore: jest.fn(),
      bulkDelete: jest.fn(),
      bulkRestore: jest.fn(),
      findScheduledDue: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPostsListHandler,
        { provide: POST_REPOSITORY, useValue: mockRepo },
        {
          provide: LoggerService,
          useValue: { info: jest.fn(), setContext: jest.fn() },
        },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-id') },
        },
      ],
    }).compile();

    handler = module.get(GetPostsListHandler);
  });

  it('returns paginated results', async () => {
    const result = await handler.execute(new GetPostsListQuery(baseFilters));
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('passes filters to repository', async () => {
    const filters: PostFiltersInput = {
      postStatus: 'published',
      categoryId: '11111111-1111-1111-1111-111111111111',
      search: 'hello',
      page: 2,
      limit: 10,
    };
    await handler.execute(new GetPostsListQuery(filters));

    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        postStatus: 'published',
        categoryId: '11111111-1111-1111-1111-111111111111',
        search: 'hello',
        page: 2,
        limit: 10,
      }),
    );
  });

  it('resolves trashed mode from flags', async () => {
    await handler.execute(
      new GetPostsListQuery({ ...baseFilters, withTrashed: true }),
    );
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ trashed: 'include' }),
    );
  });

  it('defaults trashed to exclude', async () => {
    await handler.execute(new GetPostsListQuery(baseFilters));
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ trashed: 'exclude' }),
    );
  });
});
