import { Injectable } from '@nestjs/common';
import {
  IAiDetectionPort,
  AiDetectionInput,
} from '../../../domain/ports/ai-detection.port';
import type { AiDetectionScore } from '../../../domain/entities/campaign-generation.aggregate';

/**
 * STUB implementation for AI detection analysis.
 * Replace with real adapter (e.g., Originality.ai, GPTZero, or custom model).
 *
 * Quality gate thresholds:
 * - humanWritten >= 70% → PASS
 * - showsAiSigns <= 30% → PASS
 */
@Injectable()
export class StubAiDetectionAdapter implements IAiDetectionPort {
  async analyze(_input: AiDetectionInput): Promise<AiDetectionScore> {
    return {
      showsAiSigns: 24,
      aiGenerated: 12,
      aiParaphrased: 8,
      humanWritten: 80,
    };
  }
}
