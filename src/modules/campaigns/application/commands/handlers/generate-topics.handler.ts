import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { LoggerService } from '../../../../../logger/logger.service';
import { VIRALITY_RESEARCH_PORT } from '../../../domain/ports/virality-research.port';
import type { IViralityResearchPort } from '../../../domain/ports/virality-research.port';
import { GenerateTopicsCommand } from '../generate-topics.command';
import type { GenerateTopicsResponse } from '../../dtos/generate-topics.dto';

@Injectable()
@CommandHandler(GenerateTopicsCommand)
export class GenerateTopicsHandler
  implements ICommandHandler<GenerateTopicsCommand, GenerateTopicsResponse>
{
  constructor(
    @Inject(VIRALITY_RESEARCH_PORT)
    private readonly viralityResearch: IViralityResearchPort,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(GenerateTopicsHandler.name);
  }

  async execute(
    command: GenerateTopicsCommand,
  ): Promise<GenerateTopicsResponse> {
    const { dto, actorId } = command;

    this.logger.info('Generating campaign topics', {
      actorId,
      niche: dto.niche,
      location: dto.location,
    });

    // Call virality research port to get topics
    const result = await this.viralityResearch.research({
      niche: dto.niche,
      location: dto.location,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      language: dto.language ?? 'es',
      aiObservations: dto.aiObservations ?? null,
    });

    // Transform research into topic objects. Funnel stages rotate across the
    // four stages (never a hardcoded TOFU) and scores fan out around the
    // research base score so the client can rank them.
    const FUNNEL_STAGES = ['TOFU', 'MOFU', 'BOFU', 'LOYALTY'] as const;
    const topics = result.trendingTopics.map((topic, index) => ({
      id: `topic-${index + 1}`,
      title: topic,
      description:
        result.similarCampaigns[index]?.snippet ??
        `Campaign angle for ${dto.niche} in ${dto.location}.`,
      score: Math.max(50, Math.min(100, Math.round(result.score - index * 2))),
      funnelStage: FUNNEL_STAGES[index % FUNNEL_STAGES.length],
    }));

    return {
      localMarketAnalysis: {
        targetAudience: `Target audience for ${dto.niche} in ${dto.location}`,
        keyPainPoints: result.recommendations,
        competitiveLandscape: result.leadMetrics.competitiveness,
      },
      topics,
    };
  }
}
