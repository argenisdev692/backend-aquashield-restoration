jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreatePostHandler } from '../../../application/commands/handlers/create-post.handler';
import { CreatePostCommand } from '../../../application/commands/create-post.command';
import {
  IPostRepository,
  POST_REPOSITORY,
} from '../../../domain/repositories/post-repository.interface';
import {
  IAuditPort,
  AUDIT_PORT,
} from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT, ICachePort } from '../../../../../shared/cache/cache.port';
import { AI_POST_GENERATION_PORT } from '../../../domain/ports/ai-post-generation.port';
import type { AiPostGenerationPort } from '../../../domain/ports/ai-post-generation.port';
import { PostCreatedEvent } from '../../../domain/events/post-created.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import type { CreatePostInput } from '../../../application/dtos/create-post.dto';

describe('CreatePostHandler', () => {
  let handler: CreatePostHandler;
  let mockRepo: jest.Mocked<IPostRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockCache: jest.Mocked<ICachePort>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockCls: jest.Mocked<ClsService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;

  const baseDto: CreatePostInput = {
    postTitle: 'Test Post',
    postContent: 'Test content',
    postStatus: 'draft',
  };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn(),
      findReadModelById: jest.fn(),
      findIdBySlug: jest.fn().mockResolvedValue(null),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      restore: jest.fn(),
      bulkDelete: jest.fn(),
      bulkRestore: jest.fn(),
      findScheduledDue: jest.fn(),
    };
    mockAudit = { log: jest.fn() };
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
    };
    // Acceptable cast in tests only: Jest manual mock of complex injectable services.
    // Production code has zero `any` / `as unknown as`. Documented exception per BACKEND-NEST §0.
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;
    mockCls = { get: jest.fn().mockReturnValue('trace-123') } as unknown as jest.Mocked<ClsService>;
    mockEventEmitter = { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;

    const mockAiGeneration: jest.Mocked<AiPostGenerationPort> = {
      generatePreview: jest.fn().mockResolvedValue({
        postContent: 'AI generated content',
        postTitleSlug: 'ai-generated-slug',
        postExcerpt: 'AI excerpt',
        metaTitle: 'AI meta title',
        metaDescription: 'AI meta desc',
        metaKeywords: 'ai,keywords',
        generatedImageUrl: null,
        sources: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePostHandler,
        { provide: POST_REPOSITORY, useValue: mockRepo },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: CACHE_PORT, useValue: mockCache },
        { provide: AI_POST_GENERATION_PORT, useValue: mockAiGeneration },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ClsService, useValue: mockCls },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    handler = module.get(CreatePostHandler);
  });

  it('creates a post, audits, invalidates cache, and emits event', async () => {
    const id = await handler.execute(
      new CreatePostCommand(baseDto, 'user-123'),
    );

    expect(id).toEqual(expect.any(String));
    expect(mockRepo.save).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'posts.created',
        actorId: 'user-123',
        resourceId: expect.any(String),
      }),
      { strict: true },
    );
    expect(mockCache.delByPattern).toHaveBeenCalledWith('posts-service:post:*');
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'post.created',
      expect.any(PostCreatedEvent),
    );
  });

  it('creates a post with published status', async () => {
    const id = await handler.execute(
      new CreatePostCommand({ ...baseDto, postStatus: 'published' }, 'user-123'),
    );

    expect(id).toEqual(expect.any(String));
    expect(mockRepo.save).toHaveBeenCalled();
  });
});
