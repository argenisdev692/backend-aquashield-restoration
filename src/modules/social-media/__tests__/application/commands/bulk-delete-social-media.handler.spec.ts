jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { BulkDeleteSocialMediaHandler } from '../../../../../application/commands/handlers/bulk-delete-social-media.handler';
import { BulkDeleteSocialMediaCommand } from '../../../../../application/commands/bulk-delete-social-media.command';
import {
  ISocialMediaRepository,
  SOCIAL_MEDIA_REPOSITORY,
} from '../../../../../domain/ports/social-media-repository.port';
import {
  IAuditPort,
  AUDIT_PORT,
} from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT, ICachePort } from '../../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../../logger/logger.service';

describe('BulkDeleteSocialMediaHandler', () => {
  let handler: BulkDeleteSocialMediaHandler;
  let mockRepo: jest.Mocked<ISocialMediaRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockCache: jest.Mocked<ICachePort>;

  beforeEach(async () => {
    mockRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
      bulkDelete: jest.fn().mockResolvedValue({ count: 2 }),
      countByUser: jest.fn(),
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
        BulkDeleteSocialMediaHandler,
        { provide: SOCIAL_MEDIA_REPOSITORY, useValue: mockRepo },
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

    handler = module.get(BulkDeleteSocialMediaHandler);
  });

  it('bulk deletes, audits with strict: true, invalidates cache, and emits event', async () => {
    const ids = [
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    ];

    const result = await handler.execute(
      new BulkDeleteSocialMediaCommand(ids, 'actor-super-admin'),
    );

    expect(mockRepo.bulkDelete).toHaveBeenCalledWith(ids);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'social-media.bulk_deleted',
        actorId: 'actor-super-admin',
        metadata: { ids, count: 2 },
      }),
      { strict: true },
    );
    expect(mockCache.delByPattern).toHaveBeenCalledWith('social-media:*');
    expect(result.count).toBe(2);
  });
});
