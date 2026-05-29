import type { ResearchResult } from '../value-objects/research-result.vo';
import type { SocialIdeaSet } from '../value-objects/social-content-idea.vo';
import type { SocialPostPackage } from '../value-objects/social-post-package.vo';
import type {
  SocialPostScores,
  ScoreWeakness,
} from '../value-objects/social-post-scores.vo';

export const SOCIAL_POST_GENERATION_PORT = Symbol('SocialPostGenerationPort');

export interface SocialIdeasInput {
  niche: string;
  audience?: string;
  platforms: string[];
  goal?: string;
  voice?: string;
  company?: string;
}

export interface SelectedIdeaInput {
  id: number;
  title: string;
  angle: string;
  hook: string;
  platform: string;
  format: string;
  keyTrend: string;
}

export interface SocialPackageContext {
  niche: string;
  audience?: string;
  goal?: string;
  voice?: string;
  company?: string;
}

export interface GeneratePackageParams {
  idea: SelectedIdeaInput;
  context: SocialPackageContext;
  research: ResearchResult;
  /** 1-based iteration index inside the quality loop. */
  iteration: number;
  /** Scores from the previous attempt, or null on the first iteration. */
  previousScores: SocialPostScores | null;
  /** Specific weaknesses to target this iteration (empty on iteration 1). */
  weaknesses: ScoreWeakness[];
}

/**
 * AI generation contract for the 2-step social-media flow.
 * Research grounding is provided by the caller (the processor runs the quality
 * loop and refreshes Tavily research with rotating queries per iteration).
 */
export interface SocialPostGenerationPort {
  /** Step 1 — niche analysis + 10 scored content ideas. */
  generateIdeas(
    input: SocialIdeasInput,
    research: ResearchResult,
  ): Promise<SocialIdeaSet>;

  /** Step 2 — one attempt at a full multi-platform package with 5 scores. */
  generatePackage(params: GeneratePackageParams): Promise<SocialPostPackage>;
}
