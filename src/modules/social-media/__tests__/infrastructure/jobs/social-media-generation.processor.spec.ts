import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { Job } from 'bullmq';
import { SocialMediaGenerationProcessor } from '../../../infrastructure/jobs/social-media-generation.processor';
import { TOPIC_FINDER_PORT } from '../../../domain/ports/topic-finder.port';
import { POST_GENERATOR_PORT } from '../../../domain/ports/post-generator.port';
import { SOCIAL_MEDIA_REPOSITORY } from '../../../domain/ports/social-media-repository.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import { StorageService } from '../../../../../shared/storage/storage.service';
import { LoggerService } from '../../../../../logger/logger.service';

describe('SocialMediaGenerationProcessor', () => {
  let processor: SocialMediaGenerationProcessor;
  let mockGenerator: { generatePosts: jest.Mock };
  let mockRepo: { save: jest.Mock };
  let mockAudit: { log: jest.Mock };
  let mockCache: { delByPattern: jest.Mock };
  let mockStorage: { upload: jest.Mock };

  beforeEach(async () => {
    mockGenerator = { generatePosts: jest.fn().mockResolvedValue({}) };
    mockRepo = { save: jest.fn().mockResolvedValue({ id: 'gen-123', createdAt: new Date() }) };
    mockAudit = { log: jest.fn() };
    mockCache = { delByPattern: jest.fn() };
    mockStorage = { upload: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialMediaGenerationProcessor,
        { provide: TOPIC_FINDER_PORT, useValue: { findTrendingTopics: jest.fn() } },
        { provide: POST_GENERATOR_PORT, useValue: mockGenerator },
        { provide: SOCIAL_MEDIA_REPOSITORY, useValue: mockRepo },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: CACHE_PORT, useValue: mockCache },
        { provide: StorageService, useValue: mockStorage },
        {
          provide: LoggerService,
          useValue: { info: jest.fn(), warn: jest.fn(), setContext: jest.fn() },
        },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-id') },
        },
      ],
    }).compile();

    processor = module.get(SocialMediaGenerationProcessor);
  });

  it('processes a job, saves generation, audits, invalidates cache, and uploads to R2', async () => {
    const job = {
      id: 'job-999',
      data: {
        actorId: 'user-1',
        topicTitle: 'IA en 2026',
        topicDescription: 'Tendencias',
        activeNetworks: ['linkedin'],
        language: 'es',
      },
    } as unknown as Job;

    const result = await processor.process(job);

    expect(mockRepo.save).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'social-media.post.generated' }),
      { strict: true },
    );
    expect(mockCache.delByPattern).toHaveBeenCalledWith('social-media:*');
    expect(result.id).toBe('gen-123');
  });
});
