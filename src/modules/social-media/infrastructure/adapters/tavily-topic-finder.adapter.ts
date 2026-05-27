import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { type IPolicy } from 'cockatiel';
import { createExternalServicePolicy } from '../../../../shared/external/resilience';
import type {
  ITopicFinderPort,
  TopicFinderFilters,
} from '../../domain/ports/topic-finder.port';
import type { SocialMediaTopic } from '../../domain/entities/social-media-topic.entity';
import { createSocialMediaTopic } from '../../domain/entities/social-media-topic.entity';

interface TavilyResultItem {
  title?: string;
  content?: string;
  url?: string;
  score?: number;
}

interface TavilySearchResponse {
  results?: TavilyResultItem[];
  answer?: string;
}

@Injectable()
export class TavilyTopicFinderAdapter
  implements ITopicFinderPort, OnModuleInit
{
  private readonly apiKey: string;
  private readonly searchUrl: string;
  private resilience!: IPolicy;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(TavilyTopicFinderAdapter.name);
    this.apiKey = this.config.getOrThrow<string>('TAVILY_API_KEY');
    this.searchUrl = this.config.get<string>(
      'TAVILY_SEARCH_URL',
      'https://api.tavily.com/search',
    );
  }

  onModuleInit(): void {
    this.resilience = createExternalServicePolicy('tavily', 'research');
  }

  async findTrendingTopics(
    filters: TopicFinderFilters,
  ): Promise<SocialMediaTopic[]> {
    const traceId = this.cls.get<string>('traceId');
    const { niche, language = 'es', maxTopics = 8 } = filters;

    this.logger.info('TavilyTopicFinderAdapter.findTrendingTopics start', {
      traceId,
      niche,
      language,
    });

    if (!this.apiKey) {
      this.logger.warn('TavilyTopicFinderAdapter: no API key configured', {
        traceId,
      });
      return [];
    }

    const query = `tendencias virales y temas populares sobre ${niche} en ${language} para redes sociales 2025`;

    try {
      const result = await this.resilience.execute(async () => {
        const resp = await fetch(this.searchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: this.apiKey,
            query,
            search_depth: 'advanced',
            include_answer: true,
            max_results: Math.min(maxTopics, 10),
            topic: 'news',
            exclude_domains: ['pinterest.com', 'quora.com', 'facebook.com'],
          }),
        });

        if (!resp.ok) {
          throw new Error(`Tavily HTTP ${resp.status}`);
        }
        return resp.json();
      });

      const tavily = result as TavilySearchResponse;

      const topics: SocialMediaTopic[] = (tavily.results || [])
        .slice(0, maxTopics)
        .map((item, index) => {
          const title = item.title || `Tendencia ${index + 1} en ${niche}`;
          const description =
            item.content?.slice(0, 280) ||
            tavily.answer?.slice(0, 280) ||
            `Tema viral relacionado con ${niche}`;
          return createSocialMediaTopic({
            title,
            description,
            whyViral: `Contenido de alto engagement sobre ${niche} basado en tendencias actuales.`,
            tags: [niche.toLowerCase(), 'viral', 'tendencia'],
            trendScore: Math.round((item.score ?? 0.7) * 100),
          });
        });

      this.logger.info('TavilyTopicFinderAdapter.findTrendingTopics done', {
        traceId,
        topicsCount: topics.length,
      });

      return topics;
    } catch (error) {
      this.logger.warn('TavilyTopicFinderAdapter request failed', {
        traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
