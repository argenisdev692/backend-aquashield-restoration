/**
 * Campaign quality scores — the 5 metrics the generation quality loop optimises.
 *
 * Source of truth for the thresholds and the pass/fail evaluation described in
 * `docs/AI-MODULES/CAMPAIGNS/prompt-campaigns-generator-v2.md` ("Loop de Calidad").
 *
 * Pure domain logic: no NestJS / Prisma / infra imports.
 */

export interface ScoreResult {
  /** 0-100 */
  value: number;
  /** Minimum value required to pass. */
  threshold: number;
  /** Convenience flag (value >= threshold). */
  passes: boolean;
  /** Human-readable justification produced by the AI. */
  explanation: string;
}

export interface CampaignScores {
  localMarketFit: ScoreResult;
  viralityProbability: ScoreResult;
  roiPotential: ScoreResult;
  audienceAlignment: ScoreResult;
  trendRelevance: ScoreResult;
}

export interface ScoreWeakness {
  /** Score key, e.g. `localMarketFit`. */
  score: keyof CampaignScores;
  current: number;
  target: number;
  gap: number;
  explanation: string;
}

export interface ScoreEvaluation {
  allPass: boolean;
  failing: ScoreWeakness[];
  overallAverage: number;
}

/** Minimum thresholds — Local Market Fit is the critical gate (75), rest 70. */
export const CAMPAIGN_THRESHOLDS: Record<keyof CampaignScores, number> = {
  localMarketFit: 75,
  viralityProbability: 70,
  roiPotential: 70,
  audienceAlignment: 70,
  trendRelevance: 70,
};

/** Maximum regeneration attempts before returning the best attempt. */
export const MAX_QUALITY_ITERATIONS = 5;

const SCORE_KEYS = Object.keys(CAMPAIGN_THRESHOLDS) as Array<
  keyof CampaignScores
>;

function clamp(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

/**
 * Builds a {@link ScoreResult} from a raw AI value, applying the canonical
 * threshold for the given key and recomputing `passes` defensively.
 */
export function buildScoreResult(
  key: keyof CampaignScores,
  value: number,
  explanation = '',
): ScoreResult {
  const threshold = CAMPAIGN_THRESHOLDS[key];
  const v = clamp(value);
  return { value: v, threshold, passes: v >= threshold, explanation };
}

/** Evaluates all 5 scores against their thresholds. */
export function evaluateCampaignScores(
  scores: CampaignScores,
): ScoreEvaluation {
  const failing: ScoreWeakness[] = [];
  let sum = 0;

  for (const key of SCORE_KEYS) {
    const score = scores[key];
    const value = clamp(score?.value ?? 0);
    sum += value;
    const target = CAMPAIGN_THRESHOLDS[key];
    if (value < target) {
      failing.push({
        score: key,
        current: value,
        target,
        gap: target - value,
        explanation: score?.explanation ?? '',
      });
    }
  }

  return {
    allPass: failing.length === 0,
    failing,
    overallAverage: Math.round(sum / SCORE_KEYS.length),
  };
}
