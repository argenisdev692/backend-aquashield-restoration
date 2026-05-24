jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { BulkDeletePostsHandler } from '../../../application/commands/handlers/bulk-delete-posts.handler';
import { BulkDeletePostsCommand } from '../../../application/commands/bulk-delete-posts.command';
import {
  IPostRepository,
  POST_REPOSITORY,
} from '../../../domain/repositories/post-repository.interface';
import {
  IAuditPort,
  AUDIT_PORT,
} from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT, ICachePort } from '../../../../../shared/cache/cache.port';
import { PostsBulkDeletedEvent } from '../../../domain/events/posts-bulk-deleted.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';

describe('BulkDeletePostsHandler', () => {
  let handler: BulkDeletePostsHandler;
  let mockRepo: jest.Mocked<IPostRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockCache: jest.Mocked<ICachePort>;

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn(),
      findReadModelById: jest.fn(),
      findIdBySlug: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      restore: jest.fn(),
      bulkDelete: jest.fn().mockResolvedValue({ count: 3 }),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkDeletePostsHandler,
        { provide: POST_REPOSITORY, useValue: mockRepo },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: CACHE_PORT, useValue: mockCache },
        {
          provide: LoggerService,
          useValue: { info: jest.fn(), setContext: jest.fn() },
        },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-id') },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    handler = module.get(BulkDeletePostsHandler);
  });

  it('bulk deletes, audits with ids in metadata, invalidates cache, and emits', async () => {
    const ids = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'];
    const result = await handler.execute(
      new BulkDeletePostsCommand(ids, 'actor-1'),
    );

    expect(result).toEqual({ count: 3 });
    expect(mockRepo.bulkDelete).toHaveBeenCalledWith(ids);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'posts.bulk_deleted',
        actorId: 'actor-1',
        resourceType: 'POST',
        metadata: { ids, count: 3 },
      }),
      { strict: true },
    );
    expect(mockCache.delByPattern).toHaveBeenCalledWith('posts-service:post:*');
  });

  it('sets resourceId to the single id when only one is deleted', async () => {
    const ids = ['11111111-1111-1111-1111-111111111111'];
    await handler.execute(new BulkDeletePostsCommand(ids, 'actor-1'));

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: ids[0],
      }),
      { strict: true },
    );
  });
});
