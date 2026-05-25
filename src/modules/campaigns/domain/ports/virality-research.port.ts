/**
 * Result of a virality + ROI research query via Tavily.
 */
export interface ViralityResearchResult {
  score: number;
  trendingTopics: string[];
  similarCampaigns: Array<{
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
 * Input for virality + ROI research.
 */
export interface ViralityResearchInput {
  niche: string;
  location: string;
  city?: string;
  state?: string;
  country?: string;
  language: string;
  aiObservations?: string | null;
}

/**
 * Port: Researches current trends and virality potential for a campaign niche/location.
 * Implemented by Tavily adapter.
 */
export interface IViralityResearchPort {
  research(input: ViralityResearchInput): Promise<ViralityResearchResult>;
}

export const VIRALITY_RESEARCH_PORT = Symbol('IViralityResearchPort');
