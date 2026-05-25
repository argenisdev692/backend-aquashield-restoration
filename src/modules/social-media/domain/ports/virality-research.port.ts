/**
 * Result of a virality + ROI research query via Tavily for social media posts.
 */
export interface ViralityResearchResult {
  score: number;
  trendingTopics: string[];
  similarPosts: Array<{
    title: string;
    url: string;
    snippet: string;
    engagementEstimate: 'low' | 'medium' | 'high' | 'viral';
  }>;
  recommendations: string[];
  roiScore: number;
  leadMetrics: {
    estimatedCpl: number;
    estimatedConversionRate: number;
    marketSize: 'small' | 'medium' | 'large' | 'massive';
    competitiveness: 'low' | 'medium' | 'high' | 'saturated';
    projectedLeadsPerMonth: number;
  };
}

/**
 * Input for virality + ROI research for social media.
 */
export interface ViralityResearchInput {
  niche: string;
  topicTitle: string;
  topicDescription?: string | null;
  language: string;
}

/**
 * Port: Researches current trends and virality potential for a social media post niche/topic.
 * Implemented by Tavily adapter.
 */
export interface IViralityResearchPort {
  research(input: ViralityResearchInput): Promise<ViralityResearchResult>;
}

export const VIRALITY_RESEARCH_PORT = Symbol('IViralityResearchPort');
