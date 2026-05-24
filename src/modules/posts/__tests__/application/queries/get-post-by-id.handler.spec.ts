import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { GetPostByIdHandler } from '../../../application/queries/handlers/get-post-by-id.handler';
import { GetPostByIdQuery } from '../../../application/queries/get-post-by-id.query';
import {
  POST_REPOSITORY,
  type IPostRepository,
  type PostReadModel,
} from '../../../domain/repositories/post-repository.interface';
import { LoggerService } from '../../../../../logger/logger.service';

describe('GetPostByIdHandler', () => {
  let handler: GetPostByIdHandler;
  let mockRepo: jest.Mocked<IPostRepository>;

  const readModel: PostReadModel = {
    id: '11111111-1111-1111-1111-111111111111',
    postTitle: 'Test Post',
    postTitleSlug: 'test-post',
    postContent: 'Content',
    postExcerpt: null,
    postCoverImage: null,
    metaTitle: null,
    metaDescription: null,
    metaKeywords: null,
    categoryId: null,
    userId: null,
    postStatus: 'draft',
    scheduledAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn(),
      findReadModelById: jest.fn().mockResolvedValue(readModel),
      findIdBySlug: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      restore: jest.fn(),
      bulkDelete: jest.fn(),
      bulkRestore: jest.fn(),
      findScheduledDue: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPostByIdHandler,
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

    handler = module.get(GetPostByIdHandler);
  });

  it('returns the read model when found', async () => {
    const result = await handler.execute(
      new GetPostByIdQuery('11111111-1111-1111-1111-111111111111'),
    );
    expect(result).toEqual(readModel);
    expect(mockRepo.findReadModelById).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      false,
    );
  });

  it('passes withTrashed flag to repository', async () => {
    await handler.execute(
      new GetPostByIdQuery('11111111-1111-1111-1111-111111111111', true),
    );
    expect(mockRepo.findReadModelById).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      true,
    );
  });

  it('throws NotFoundException when not found', async () => {
    mockRepo.findReadModelById.mockResolvedValue(null);
    await expect(
      handler.execute(new GetPostByIdQuery('nonexistent')),
    ).rejects.toThrow(NotFoundException);
  });
});
