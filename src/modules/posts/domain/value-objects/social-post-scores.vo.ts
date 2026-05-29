/**
 * Quality scoring gatekeeper for the social-media post generator.
 *
 * Pure domain logic — no framework, no infrastructure. Encodes the thresholds
 * and the auto-regeneration decision from
 * `docs/AI-MODULES/POSTS/prompt-social-media-post-generator-v2.md`:
 *
 *   The system NEVER returns content until ALL scores pass their thresholds,
 *   or MAX_ITERATIONS is reached (then the best attempt is returned with
 *   `qualityWarning: true`). Human Writing Index is the critical gatekeeper.
 */

export const SCORE_THRESHOLDS = {
  humanWritingIndex: 75,
  eeatScore: 70,
  viralityScore: 70,
  roiScore: 70,
  seoScore: 70,
} as const;

export type ScoreKey = keyof typeof SCORE_THRESHOLDS;

export const SCORE_KEYS: readonly ScoreKey[] = [
  'humanWritingIndex',
  'eeatScore',
  'viralityScore',
  'roiScore',
  'seoScore',
];

/** The most important score — failing it always forces a regeneration. */
export const CRITICAL_SCORE: ScoreKey = 'humanWritingIndex';

/** Maximum regeneration attempts per generation before returning the best one. */
export const MAX_QUALITY_ITERATIONS = 5;

export interface QualityScore {
  value: number;
  explanation: string;
  /** AI-provided sub-factors (shape varies by score); kept opaque on purpose. */
  factors: string[];
}

export interface SocialPostScores {
  humanWritingIndex: QualityScore;
  eeatScore: QualityScore;
  viralityScore: QualityScore;
  roiScore: QualityScore;
  seoScore: QualityScore;
}

export interface ScoreWeakness {
  score: ScoreKey;
  current: number;
  target: number;
  gap: number;
  explanation: string;
}

export interface ScoreEvaluation {
  allPass: boolean;
  failingScores: ScoreKey[];
  weaknesses: ScoreWeakness[];
  overallAverage: number;
}

function valueOf(scores: SocialPostScores, key: ScoreKey): number {
  const raw = scores[key]?.value;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/**
 * Evaluates a generated package against the thresholds.
 * `allPass` is true only when every score meets or exceeds its threshold,
 * which inherently enforces the critical Human Writing Index ≥ 75 rule.
 */
export function evaluateScores(scores: SocialPostScores): ScoreEvaluation {
  const weaknesses: ScoreWeakness[] = [];

  for (const key of SCORE_KEYS) {
    const current = valueOf(scores, key);
    const target = SCORE_THRESHOLDS[key];
    if (current < target) {
      weaknesses.push({
        score: key,
        current,
        target,
        gap: target - current,
        explanation: scores[key]?.explanation ?? '',
      });
    }
  }

  const sum = SCORE_KEYS.reduce((acc, key) => acc + valueOf(scores, key), 0);
  const overallAverage = Math.round(sum / SCORE_KEYS.length);

  return {
    allPass: weaknesses.length === 0,
    failingScores: weaknesses.map((w) => w.score),
    weaknesses,
    overallAverage,
  };
}

/** Average of all five scores (0–100), rounded. */
export function overallAverage(scores: SocialPostScores): number {
  return evaluateScores(scores).overallAverage;
}
