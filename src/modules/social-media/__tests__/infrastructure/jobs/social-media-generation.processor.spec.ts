import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { Job } from 'bullmq';
import { SocialMediaGenerationProcessor } from '../../../infrastructure/jobs/social-media-generation.processor';
import { TOPIC_FINDER_PORT } from '../../../domain/ports/topic-finder.port';
import { POST_GENERATOR_PORT } from '../../../domain/ports/post-generator.port';
import { IMAGE_GENERATOR_PORT } from '../../../domain/ports/image-generator.port';
import { VIRALITY_RESEARCH_PORT } from '../../../domain/ports/virality-research.port';
import { AI_DETECTION_PORT } from '../../../domain/ports/ai-detection.port';
import { SOCIAL_MEDIA_REPOSITORY } from '../../../domain/ports/social-media-repository.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import { STORAGE_PORT } from '../../../../../shared/storage/storage.port';
import { TRANSACTION_MANAGER } from '../../../../../shared/database/transaction-manager.port';
import { LoggerService } from '../../../../../logger/logger.service';
import { SocialMediaGateway } from '../../../infrastructure/gateways/social-media.gateway';
import { CompanyBrandingService } from '../../../../companydata/company-branding.service';

describe('SocialMediaGenerationProcessor', () => {
  let processor: SocialMediaGenerationProcessor;
  let mockGenerator: { generatePostsWithFeedback: jest.Mock };
  let mockRepo: { save: jest.Mock; update: jest.Mock };
  let mockAudit: { log: jest.Mock };
  let mockCache: { delByPattern: jest.Mock };
  let mockStorage: {
    upload: jest.Mock;
    delete: jest.Mock;
    publicUrl: jest.Mock;
  };
  let mockGateway: {
    broadcastGenerationProgress: jest.Mock;
    broadcastGenerationCompleted: jest.Mock;
    broadcastGenerationFailed: jest.Mock;
  };

  const savedGeneration = {
    id: 'gen-123',
    userId: 'user-1',
    niche: 'IA en 2026',
    topicTitle: 'IA en 2026',
    topicDescription: 'Tendencias',
    language: 'es',
    networks: { linkedin: true },
    generatedPosts: { linkedin: { body: 'Hello LinkedIn', hashtags: ['#ai'] } },
    viralityScore: 80,
    roiScore: 75,
    aiDetectionScore: {
      aiGenerated: 10,
      aiParaphrased: 5,
      humanWritten: 85,
      showsAiSigns: 10,
    },
    analysisReportKey: null,
    analysisReportUrl: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockGenerator = {
      generatePostsWithFeedback: jest.fn().mockResolvedValue({
        linkedin: { body: 'Hello LinkedIn', hashtags: ['#ai'] },
        scores: {
          human_writing_index: 82,
          virality_score: 78,
          engagement_score: 80,
          roi_score: 76,
          trend_alignment: 79,
        },
        ai_detection_risk: 15,
      }),
    };
    mockRepo = {
      save: jest.fn().mockResolvedValue(savedGeneration),
      update: jest.fn().mockResolvedValue(savedGeneration),
    };
    mockAudit = { log: jest.fn() };
    mockCache = { delByPattern: jest.fn() };
    mockStorage = {
      upload: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      publicUrl: jest.fn().mockReturnValue('https://r2.example.com/key.png'),
    };
    mockGateway = {
      broadcastGenerationProgress: jest.fn(),
      broadcastGenerationCompleted: jest.fn(),
      broadcastGenerationFailed: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialMediaGenerationProcessor,
        {
          provide: TOPIC_FINDER_PORT,
          useValue: { findTrendingTopics: jest.fn() },
        },
        { provide: POST_GENERATOR_PORT, useValue: mockGenerator },
        {
          provide: IMAGE_GENERATOR_PORT,
          useValue: {
            generateImage: jest.fn().mockResolvedValue({
              base64: Buffer.from('img').toString('base64'),
              mimeType: 'image/png',
            }),
          },
        },
        {
          provide: VIRALITY_RESEARCH_PORT,
          useValue: {
            research: jest.fn().mockResolvedValue({
              score: 80,
              trendingTopics: ['AI'],
              similarPosts: [],
              recommendations: [],
              roiScore: 75,
              leadMetrics: {
                estimatedCpl: 5,
                estimatedConversionRate: 2,
                marketSize: 'large',
                competitiveness: 'medium',
                projectedLeadsPerMonth: 100,
              },
            }),
          },
        },
        {
          provide: AI_DETECTION_PORT,
          useValue: {
            analyze: jest.fn().mockResolvedValue({
              aiGenerated: 10,
              aiParaphrased: 5,
              humanWritten: 85,
              showsAiSigns: 10,
            }),
          },
        },
        { provide: SOCIAL_MEDIA_REPOSITORY, useValue: mockRepo },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: CACHE_PORT, useValue: mockCache },
        { provide: STORAGE_PORT, useValue: mockStorage },
        {
          provide: TRANSACTION_MANAGER,
          useValue: { runInTx: jest.fn((fn: () => unknown) => fn()) },
        },
        {
          provide: LoggerService,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            setContext: jest.fn(),
          },
        },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('trace-id') },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: SocialMediaGateway, useValue: mockGateway },
        {
          provide: CompanyBrandingService,
          useValue: { getFallbackName: () => 'Company' },
        },
      ],
    }).compile();

    processor = module.get(SocialMediaGenerationProcessor);
  });

  it('processes a job, saves generation, audits, invalidates cache, and emits progress', async () => {
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

    expect(mockGenerator.generatePostsWithFeedback).toHaveBeenCalled();
    expect(mockGateway.broadcastGenerationProgress).toHaveBeenCalledWith(
      expect.objectContaining({ iteration: 1, allPassed: true }),
    );
    expect(mockRepo.save).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'social-media.post.generated' }),
      { strict: true },
    );
    expect(mockCache.delByPattern).toHaveBeenCalledWith(
      'http:*:/social-media*',
    );
    expect(result.id).toBe('gen-123');
  });
});
