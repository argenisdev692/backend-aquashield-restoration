import { type Prisma } from '../../../../../generated/prisma/client';
import type { SocialMediaGeneration } from '../../../../../generated/prisma/client';
import type {
  PersistSocialGenerationInput,
  SocialGenerationRecord,
} from '../../../domain/repositories/social-generation-repository.interface';
import type { SocialPostPackage } from '../../../domain/value-objects/social-post-package.vo';

/**
 * Maps between the persisted `SocialMediaGeneration` row and the social
 * generation domain shapes. The full package is stored verbatim in the
 * `generatedPosts` JSON column so the ZIP export can rebuild it later.
 */
export class SocialGenerationMapper {
  static toPersistence(
    input: PersistSocialGenerationInput,
  ): Prisma.SocialMediaGenerationUncheckedCreateInput {
    const { pkg } = input;
    return {
      userId: input.userId,
      niche: input.niche,
      topicTitle: input.topicTitle.slice(0, 500),
      topicDescription: input.topicDescription,
      networks: input.networks,
      generatedPosts: pkg as unknown as Prisma.InputJsonValue,
      viralityScore: pkg.scores.viralityScore.value,
      roiScore: pkg.scores.roiScore.value,
      aiDetectionScore: pkg.aiDetectionRisk as unknown as Prisma.InputJsonValue,
      qualityScores: pkg.scores as unknown as Prisma.InputJsonValue,
      qualityWarning: pkg.metadata.qualityWarning,
      iterationsRequired: pkg.metadata.iterationsRequired,
    };
  }

  static toRecord(row: SocialMediaGeneration): SocialGenerationRecord {
    return {
      id: row.id,
      userId: row.userId,
      niche: row.niche,
      topicTitle: row.topicTitle,
      networks: Array.isArray(row.networks)
        ? (row.networks as unknown[]).map((n) => String(n))
        : [],
      pkg: row.generatedPosts as unknown as SocialPostPackage,
      qualityWarning: row.qualityWarning,
      iterationsRequired: row.iterationsRequired,
      createdAt: row.createdAt,
    };
  }
}
