jest.mock('@nestjs-cls/transactional', () => ({
  Transactional:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { DeleteSocialMediaHandler } from '../../../application/commands/handlers/delete-social-media.handler';
import { DeleteSocialMediaCommand } from '../../../application/commands/delete-social-media.command';
import {
  ISocialMediaRepository,
  SOCIAL_MEDIA_REPOSITORY,
} from '../../../domain/ports/social-media-repository.port';
import {
  IAuditPort,
  AUDIT_PORT,
} from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT, ICachePort } from '../../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../../logger/logger.service';

describe('DeleteSocialMediaHandler', () => {
  let handler: DeleteSocialMediaHandler;
  let mockRepo: jest.Mocked<ISocialMediaRepository>;
  let mockAudit: jest.Mocked<IAuditPort>;
  let mockCache: jest.Mocked<ICachePort>;

  beforeEach(async () => {
    mockRepo = {
      save: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
      bulkDelete: jest.fn(),
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
        DeleteSocialMediaHandler,
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

    handler = module.get(DeleteSocialMediaHandler);
  });

  it('throws NotFound when generation does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      handler.execute(
        new DeleteSocialMediaCommand('non-existent-id', 'actor-1'),
      ),
    ).rejects.toThrow('Social media generation not found');

    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('hard deletes, audits with strict: true, invalidates cache, and emits', async () => {
    const existing = {
      id: '11111111-1111-1111-1111-111111111111',
      userId: 'actor-1',
      niche: 'AI',
      topicTitle: 'Test',
      topicDescription: null,
      language: 'es',
      networks: { linkedin: true },
      generatedPosts: {},
      r2Key: null,
      createdAt: new Date(),
    };

    mockRepo.findById.mockResolvedValue(existing);

    await handler.execute(
      new DeleteSocialMediaCommand(existing.id, 'actor-super-admin'),
    );

    expect(mockRepo.delete).toHaveBeenCalledWith(existing.id);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'social-media.deleted',
        actorId: 'actor-super-admin',
        resourceId: existing.id,
      }),
      { strict: true },
    );
    expect(mockCache.delByPattern).toHaveBeenCalledWith('http:*:/social-media*');
  });
});
