import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ClsService } from 'nestjs-cls';
import { GenerateSocialIdeasCommand } from '../generate-social-ideas.command';
import {
  SOCIAL_POST_GENERATION_PORT,
  type SocialPostGenerationPort,
  type SocialIdeasInput,
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
import { SocialIdeaSet } from '../../../domain/value-objects/social-content-idea.vo';
import {
  buildIdeasCacheKey,
  SOCIAL_IDEAS_TTL_SECONDS,
} from '../../social/social-generation.util';

@Injectable()
@CommandHandler(GenerateSocialIdeasCommand)
export class GenerateSocialIdeasHandler implements ICommandHandler<GenerateSocialIdeasCommand> {
  constructor(
    @Inject(SOCIAL_POST_GENERATION_PORT)
    private readonly socialGeneration: SocialPostGenerationPort,
    @Inject(RESEARCH_PORT)
    private readonly research: ResearchPort,
    @Inject(CACHE_PORT)
    private readonly cache: ICachePort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GenerateSocialIdeasHandler.name);
  }

  async execute(command: GenerateSocialIdeasCommand): Promise<SocialIdeaSet> {
    const traceId = this.cls.get<string>('traceId');
    const { dto, actorId } = command;

    const input: SocialIdeasInput = {
      niche: dto.niche,
      audience: dto.audience,
      platforms: dto.platforms,
      goal: dto.goal,
      voice: dto.voice,
      company: dto.company,
    };

    this.logger.info('GenerateSocialIdeasHandler start', {
      traceId,
      niche: input.niche,
    });

    const cacheKey = buildIdeasCacheKey(input);
    const cached = await this.cache.get<SocialIdeaSet>(cacheKey);
    if (cached) {
      this.logger.info('GenerateSocialIdeasHandler cache hit', {
        traceId,
        cacheKey,
      });
      return cached;
    }

    const research = await this.research.research(
      `${input.niche} trends 2026 viral content audience pain points`,
    );

    const ideas = await this.socialGeneration.generateIdeas(input, research);

    await this.cache.set(cacheKey, ideas, SOCIAL_IDEAS_TTL_SECONDS);

    // Fire-and-forget audit (read-style generation must never abort the flow).
    await this.audit.log(
      {
        action: 'posts.social_ideas_generated',
        actorId,
        resourceType: 'SOCIAL_POST',
        metadata: { niche: input.niche, ideas: ideas.ideas.length },
      },
      { strict: false },
    );

    this.logger.info('GenerateSocialIdeasHandler end', {
      traceId,
      ideas: ideas.ideas.length,
      sources: research.sources.length,
    });

    return ideas;
  }
}
