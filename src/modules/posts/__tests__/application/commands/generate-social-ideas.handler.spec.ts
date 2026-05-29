import { Test, TestingModule } from '@nestjs/testing';
import { GenerateSocialIdeasHandler } from '../../../application/commands/handlers/generate-social-ideas.handler';
import { GenerateSocialIdeasCommand } from '../../../application/commands/generate-social-ideas.command';
import {
  SOCIAL_POST_GENERATION_PORT,
  type SocialPostGenerationPort,
} from '../../../domain/ports/social-post-generation.port';
import {
  RESEARCH_PORT,
  type ResearchPort,
} from '../../../domain/ports/research.port';
import {
  CACHE_PORT,
  type ICachePort,
} from '../../../../../shared/cache/cache.port';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { ResearchResult } from '../../../domain/value-objects/research-result.vo';
import { SocialIdeaSet } from '../../../domain/value-objects/social-content-idea.vo';
import type { GenerateSocialPostIdeasDto } from '../../../application/dtos/generate-social-post-ideas.dto';

describe('GenerateSocialIdeasHandler', () => {
  let handler: GenerateSocialIdeasHandler;
  let mockSocial: jest.Mocked<SocialPostGenerationPort>;
  let mockResearch: jest.Mocked<ResearchPort>;
  let mockCache: jest.Mocked<ICachePort>;
  let mockAudit: jest.Mocked<IAuditPort>;

  const dto: GenerateSocialPostIdeasDto = {
    niche: 'Water damage restoration',
    audience: 'Homeowners',
    platforms: ['blog', 'linkedin'],
    goal: 'leads',
    voice: 'professional',
    company: 'AquaShield',
    provider: 'gemini',
  };

  const ideaSet = new SocialIdeaSet(
    {
      targetAudience: 'Homeowners',
      audienceDemographics: '',
      keyPainPoints: [],
      contentPreferences: [],
      trendingTopics: [],
      tavilyInsights: [],
    },
    [],
  );

  beforeEach(async () => {
    mockSocial = {
      generateIdeas: jest.fn().mockResolvedValue(ideaSet),
      generatePackage: jest.fn(),
    };
    mockResearch = {
      research: jest.fn().mockResolvedValue(ResearchResult.empty()),
    };
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
    };
    mockAudit = { log: jest.fn() };

    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    const mockCls = {
      get: jest.fn().mockReturnValue('trace-1'),
    } as unknown as jest.Mocked<ClsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateSocialIdeasHandler,
        { provide: SOCIAL_POST_GENERATION_PORT, useValue: mockSocial },
        { provide: RESEARCH_PORT, useValue: mockResearch },
        { provide: CACHE_PORT, useValue: mockCache },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ClsService, useValue: mockCls },
      ],
    }).compile();

    handler = module.get(GenerateSocialIdeasHandler);
  });

  it('returns cached ideas without calling research or AI', async () => {
    mockCache.get.mockResolvedValueOnce(ideaSet);

    const result = await handler.execute(
      new GenerateSocialIdeasCommand(dto, 'user-1'),
    );

    expect(result).toBe(ideaSet);
    expect(mockResearch.research).not.toHaveBeenCalled();
    expect(mockSocial.generateIdeas).not.toHaveBeenCalled();
  });

  it('researches, generates, caches and audits on a cache miss', async () => {
    mockCache.get.mockResolvedValueOnce(null);

    const result = await handler.execute(
      new GenerateSocialIdeasCommand(dto, 'user-1'),
    );

    expect(mockResearch.research).toHaveBeenCalledTimes(1);
    expect(mockSocial.generateIdeas).toHaveBeenCalledTimes(1);
    expect(mockCache.set).toHaveBeenCalledTimes(1);
    expect(result).toBe(ideaSet);
  });

  it('audits as fire-and-forget (strict: false) — never aborts the flow', async () => {
    mockCache.get.mockResolvedValueOnce(null);

    await handler.execute(new GenerateSocialIdeasCommand(dto, 'user-1'));

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'posts.social_ideas_generated',
        actorId: 'user-1',
      }),
      { strict: false },
    );
  });
});
