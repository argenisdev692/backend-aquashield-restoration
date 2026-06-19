import { Injectable } from '@nestjs/common';
import {
  IAiDetectionPort,
  AiDetectionInput,
} from '../../domain/ports/ai-detection.port';
import type { AiDetectionScore } from '../../domain/entities/campaign-generation.aggregate';

/**
 * Local heuristic AI-detection adapter (no external API, no circuit breaker
 * needed — pure CPU). Flags the classic "AI tells": uniform sentence length and
 * cliché phrases. Returns a normalized breakdown summing to ~100.
 *
 * Replace with a vendor (Originality.ai / GPTZero) by implementing the same
 * port and wrapping the HTTP call in `createExternalServicePolicy`.
 */
@Injectable()
export class HeuristicAiDetectionAdapter implements IAiDetectionPort {
  private static readonly CLICHES = [
    'in conclusion',
    'it is important to note',
    "it's important to note",
    'in today',
    'as we can see',
    'needless to say',
    'at the end of the day',
    'moving forward',
    'leverage',
    'delve',
    'paradigm',
  ];

  async analyze(input: AiDetectionInput): Promise<AiDetectionScore> {
    const text = (input.text ?? '').toLowerCase();
    const sentences = text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const clicheHits = HeuristicAiDetectionAdapter.CLICHES.filter((c) =>
      text.includes(c),
    ).length;

    // Sentence-length variance: low variance → AI-like.
    const lengths = sentences.map((s) => s.split(/\s+/).length);
    const variance = this.variance(lengths);
    const lowVariance = lengths.length >= 3 && variance < 6;

    let aiSigns = 18 + clicheHits * 12 + (lowVariance ? 18 : 0);
    if (aiSigns > 90) aiSigns = 90;

    const humanWritten = Math.max(10, 100 - aiSigns);
    const aiGenerated = Math.round(aiSigns * 0.55);
    const aiParaphrased = Math.max(0, aiSigns - aiGenerated);

    return {
      showsAiSigns: aiSigns,
      humanWritten,
      aiGenerated,
      aiParaphrased,
    };
  }

  private variance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  }
}
