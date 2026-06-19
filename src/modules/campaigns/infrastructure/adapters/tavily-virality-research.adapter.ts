import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { type IPolicy } from 'cockatiel';
import { createExternalServicePolicy } from '../../../../shared/external/resilience';
import { LoggerService } from '../../../../logger/logger.service';
import {
  IViralityResearchPort,
  ViralityResearchInput,
  ViralityResearchResult,
} from '../../domain/ports/virality-research.port';

interface TavilyResultItem {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

interface TavilyResponse {
  results?: TavilyResultItem[];
  answer?: string;
}

/**
 * Tavily-grounded virality + ROI research for campaign topics/locations.
 *
 * Runs the geo-aware search queries from the v2 spec, then derives the scores
 * and lead metrics from the breadth/quality of the grounded results. If the key
 * is missing or Tavily fails, it degrades gracefully to a deterministic
 * heuristic so the pipeline never blocks. All HTTP goes through the breaker.
 */
@Injectable()
export class TavilyViralityResearchAdapter
  implements IViralityResearchPort, OnModuleInit
{
  private readonly apiKey: string | undefined;
  private readonly searchUrl: string;
  private readonly searchDepth: string;
  private readonly maxResults: number;
  private resilience!: IPolicy;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(TavilyViralityResearchAdapter.name);
    this.apiKey = this.config.get<string>('TAVILY_API_KEY');
    this.searchUrl = this.config.get<string>(
      'TAVILY_SEARCH_URL',
      'https://api.tavily.com/search',
    );
    this.searchDepth = this.config.get<string>(
      'TAVILY_SEARCH_DEPTH',
      'advanced',
    );
    this.maxResults = this.config.get<number>('TAVILY_MAX_RESULTS', 8);
  }

  onModuleInit(): void {
    this.resilience = createExternalServicePolicy('tavily', 'research');
  }

  async research(
    input: ViralityResearchInput,
  ): Promise<ViralityResearchResult> {
    const traceId = this.cls.get<string>('traceId');
    const geo = [input.city, input.state, input.country]
      .filter(Boolean)
      .join(' ');

    if (!this.apiKey) {
      this.logger.warn(
        'Tavily key absent — using heuristic virality research',
        {
          traceId,
        },
      );
      return this.heuristic(input);
    }

    const query = `${input.niche} viral short-form video trends ${geo || input.location} 2026`;

    try {
      const data = await this.resilience.execute(async () => {
        const resp = await fetch(this.searchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: this.apiKey,
            query,
            search_depth: this.searchDepth,
            include_answer: true,
            max_results: this.maxResults,
            exclude_domains: ['pinterest.com', 'quora.com'],
          }),
        });
        if (!resp.ok) throw new Error(`Tavily HTTP ${resp.status}`);
        return (await resp.json()) as TavilyResponse;
      });

      const results = (data.results ?? []).sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0),
      );

      const similarCampaigns = results.slice(0, 4).map((r) => ({
        title: r.title ?? 'Untitled',
        url: r.url ?? '',
        snippet: (r.content ?? '').slice(0, 240),
        engagementEstimate: this.engagementFromScore(r.score ?? 0),
      }));

      // More grounded sources + stronger relevance → higher confidence scores.
      const avgScore =
        results.length > 0
          ? results.reduce((s, r) => s + (r.score ?? 0), 0) / results.length
          : 0;
      const score = this.clamp(
        60 + avgScore * 35 + Math.min(results.length, 8),
      );
      const roiScore = this.clamp(
        58 + avgScore * 30 + Math.min(results.length, 6),
      );

      const recommendations = [
        `Hook in the first 3 seconds referencing ${input.niche} in ${geo || input.location}`,
        data.answer
          ? `Leverage current angle: ${data.answer.slice(0, 140)}`
          : 'Use a specific local data point in the hook',
        'Add a clear, single CTA aligned with the business goal',
      ];

      this.logger.info('TavilyViralityResearchAdapter.research done', {
        traceId,
        sources: results.length,
        score,
      });

      return {
        score,
        trendingTopics: results
          .slice(0, 6)
          .map((r) => r.title ?? '')
          .filter(Boolean),
        similarCampaigns,
        recommendations,
        roiScore,
        leadMetrics: {
          estimatedCpl: 11.5,
          estimatedConversionRate: 3.0,
          marketSize: results.length > 6 ? 'large' : 'medium',
          competitiveness: avgScore > 0.6 ? 'high' : 'medium',
          projectedLeadsPerMonth: Math.round(40 + results.length * 6),
        },
      };
    } catch (error) {
      this.logger.warn('Tavily research failed — heuristic fallback', {
        traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.heuristic(input);
    }
  }

  private engagementFromScore(
    score: number,
  ): 'low' | 'medium' | 'high' | 'viral' {
    if (score >= 0.8) return 'viral';
    if (score >= 0.6) return 'high';
    if (score >= 0.3) return 'medium';
    return 'low';
  }

  private clamp(n: number): number {
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  private heuristic(input: ViralityResearchInput): ViralityResearchResult {
    return {
      score: 72,
      trendingTopics: [
        `${input.niche} tendencias 2026`,
        `videos virales de ${input.niche} en ${input.location}`,
      ],
      similarCampaigns: [],
      recommendations: [
        'Usar hooks emocionales en los primeros 3 segundos',
        `Aprovechar tendencias locales de ${input.location}`,
      ],
      roiScore: 68,
      leadMetrics: {
        estimatedCpl: 12.5,
        estimatedConversionRate: 3.2,
        marketSize: 'medium',
        competitiveness: 'medium',
        projectedLeadsPerMonth: 45,
      },
    };
  }
}
