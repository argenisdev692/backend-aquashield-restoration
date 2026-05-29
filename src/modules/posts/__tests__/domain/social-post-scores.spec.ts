import {
  evaluateScores,
  overallAverage,
  SCORE_THRESHOLDS,
  type SocialPostScores,
} from '../../domain/value-objects/social-post-scores.vo';

function buildScores(values: {
  human: number;
  eeat: number;
  virality: number;
  roi: number;
  seo: number;
}): SocialPostScores {
  const score = (value: number) => ({ value, explanation: 'x', factors: [] });
  return {
    humanWritingIndex: score(values.human),
    eeatScore: score(values.eeat),
    viralityScore: score(values.virality),
    roiScore: score(values.roi),
    seoScore: score(values.seo),
  };
}

describe('evaluateScores', () => {
  it('passes when every score meets its threshold', () => {
    const result = evaluateScores(
      buildScores({ human: 80, eeat: 72, virality: 75, roi: 71, seo: 90 }),
    );

    expect(result.allPass).toBe(true);
    expect(result.failingScores).toEqual([]);
    expect(result.weaknesses).toEqual([]);
  });

  it('fails the critical Human Writing Index at 74 (threshold 75)', () => {
    const result = evaluateScores(
      buildScores({ human: 74, eeat: 90, virality: 90, roi: 90, seo: 90 }),
    );

    expect(result.allPass).toBe(false);
    expect(result.failingScores).toEqual(['humanWritingIndex']);
    expect(result.weaknesses[0]).toMatchObject({
      score: 'humanWritingIndex',
      current: 74,
      target: SCORE_THRESHOLDS.humanWritingIndex,
      gap: 1,
    });
  });

  it('collects every failing score with its gap', () => {
    const result = evaluateScores(
      buildScores({ human: 50, eeat: 60, virality: 90, roi: 65, seo: 90 }),
    );

    expect(result.allPass).toBe(false);
    expect(result.failingScores).toEqual([
      'humanWritingIndex',
      'eeatScore',
      'roiScore',
    ]);
    expect(result.weaknesses.map((w) => w.gap)).toEqual([25, 10, 5]);
  });

  it('treats a missing/NaN score as 0 (fails)', () => {
    const scores = buildScores({
      human: 80,
      eeat: 80,
      virality: 80,
      roi: 80,
      seo: 80,
    });
    // Simulate a malformed AI value.
    (scores.seoScore as { value: number }).value = Number.NaN;

    const result = evaluateScores(scores);
    expect(result.failingScores).toContain('seoScore');
  });

  it('rounds the overall average', () => {
    // (75 + 70 + 70 + 70 + 71) / 5 = 71.2 -> 71
    expect(
      overallAverage(
        buildScores({ human: 75, eeat: 70, virality: 70, roi: 70, seo: 71 }),
      ),
    ).toBe(71);
  });
});
