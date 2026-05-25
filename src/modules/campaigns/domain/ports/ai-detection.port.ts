import type { AiDetectionScore } from '../entities/campaign-generation.aggregate';

/**
 * Input for AI detection analysis.
 */
export interface AiDetectionInput {
  text: string;
  language: string;
}

/**
 * Port: Analyzes text to determine if it was AI-generated or human-written.
 * Returns a breakdown score (aiGenerated, aiParaphrased, humanWritten, showsAiSigns).
 *
 * Quality gate: content should have humanWritten >= 70% and showsAiSigns <= 30%
 * to pass as authentic human content.
 */
export interface IAiDetectionPort {
  analyze(input: AiDetectionInput): Promise<AiDetectionScore>;
}

export const AI_DETECTION_PORT = Symbol('IAiDetectionPort');
