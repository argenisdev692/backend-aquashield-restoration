import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { type IPolicy } from 'cockatiel'; // still needed for the private field type (infrastructure only)
import { createExternalServicePolicy } from '../../../../../shared/external/resilience';
import type { ResearchPort } from '../../../domain/ports/research.port';
import {
  ResearchResult,
  type Source,
} from '../../../domain/value-objects/research-result.vo';

/**
 * Minimal typed shape for the Tavily /search response (only fields we consume).
 * Keeps the adapter free of `any` while staying defensive against upstream changes.
 */
interface TavilySourceItem {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

interface TavilySearchResponse {
  results?: TavilySourceItem[];
  answer?: string;
}

@Injectable()
export class TavilyResearchAdapter implements ResearchPort, OnModuleInit {
  private readonly apiKey: string;
  private readonly searchUrl: string;
  private readonly searchDepth: string;
  private readonly maxResults: number;
  private resilience!: IPolicy;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(TavilyResearchAdapter.name);
    this.apiKey = this.config.getOrThrow<string>('TAVILY_API_KEY');
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
    // Use the centralized resilience factory (single source of truth for retry + circuit breaker).
    // 'research' profile is tuned for web grounding / search APIs (Tavily, SerpAPI, etc.).
    this.resilience = createExternalServicePolicy('tavily', 'research');
  }

  async research(query: string): Promise<ResearchResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('TavilyResearchAdapter.research start', {
      traceId,
      query,
    });

    if (!this.apiKey) {
      this.logger.warn(
        'TavilyResearchAdapter: no API key, returning empty result',
        { traceId },
      );
      return ResearchResult.empty();
    }

    try {
      const result = await this.resilience.execute(async () => {
        const resp = await fetch(this.searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: this.apiKey,
            query,
            search_depth: this.searchDepth,
            include_answer: true,
            max_results: this.maxResults,
            exclude_domains: ['pinterest.com', 'quora.com'],
          }),
        });

        if (!resp.ok) {
          throw new Error(`Tavily HTTP ${resp.status}`);
        }

        return (await resp.json()) as TavilySearchResponse;
      });

      const tavilyResponse = result;

      const sources: Source[] = (tavilyResponse.results || [])
        .map((r) => ({
          title: r.title || '',
          url: r.url || '',
          snippet: r.content || '',
          score: r.score || 0,
        }))
        .sort((a, b) => b.score - a.score);

      const summary = result.answer || '';

      this.logger.info('TavilyResearchAdapter.research done', {
        traceId,
        sourcesCount: sources.length,
      });

      return new ResearchResult(sources, summary);
    } catch (error) {
      this.logger.warn('TavilyResearchAdapter request failed', {
        traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return ResearchResult.empty();
    }
  }
}
