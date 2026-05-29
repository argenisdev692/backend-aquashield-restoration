/**
 * Step 1 output: niche analysis + 10 scored content ideas.
 * Pure domain VO — no framework dependency.
 */

export interface NicheAnalysis {
  targetAudience: string;
  audienceDemographics: string;
  keyPainPoints: string[];
  contentPreferences: string[];
  trendingTopics: string[];
  tavilyInsights: string[];
}

export interface SocialContentIdea {
  id: number;
  title: string;
  angle: string;
  hook: string;
  platform: string;
  estimatedVirality: number;
  estimatedRoi: number;
  estimatedEngagement: string;
  difficulty: string;
  eeatPotential: number;
  whyItWorks: string;
  keyTrend: string;
  suggestedFormat: string;
  contentType: string;
}

export class SocialIdeaSet {
  constructor(
    public readonly nicheAnalysis: NicheAnalysis,
    public readonly ideas: SocialContentIdea[],
  ) {}
}
