/**
 * AI Detection Score for social media posts.
 */
export interface AiDetectionScore {
  aiGenerated: number;
  aiParaphrased: number;
  humanWritten: number;
  showsAiSigns: number;
}

/**
 * Input for AI detection analysis.
 */
export interface AiDetectionInput {
  text: string;
  language: string;
}

/**
 * Port: Analyzes text to detect AI-generated content.
 * Implementation can use GPTZero, Originality.ai, or similar services.
 */
export interface IAiDetectionPort {
  analyze(input: AiDetectionInput): Promise<AiDetectionScore>;
}

export const AI_DETECTION_PORT = Symbol('IAiDetectionPort');
