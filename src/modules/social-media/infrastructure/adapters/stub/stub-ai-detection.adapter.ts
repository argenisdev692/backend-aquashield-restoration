import { Injectable } from '@nestjs/common';
import {
  IAiDetectionPort,
  AiDetectionInput,
  AiDetectionScore,
} from '../../../domain/ports/ai-detection.port';

/**
 * STUB implementation for AI detection.
 * Replace with real adapter that uses GPTZero, Originality.ai, or similar services.
 */
@Injectable()
export class StubAiDetectionAdapter implements IAiDetectionPort {
  async analyze(input: AiDetectionInput): Promise<AiDetectionScore> {
    // Placeholder: In real implementation, this would call an AI detection API
    // For now, return a realistic score based on text characteristics

    const textLength = input.text.length;
    const baseHumanScore = Math.min(70 + textLength / 100, 95);

    return {
      aiGenerated: Math.max(0, 100 - baseHumanScore - 5),
      aiParaphrased: Math.max(0, 100 - baseHumanScore - 10),
      humanWritten: baseHumanScore,
      showsAiSigns: Math.max(0, 100 - baseHumanScore - 15),
    };
  }
}
