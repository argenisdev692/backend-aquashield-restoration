import type { Prisma } from '../../../../../generated/prisma/client';
import type {
  SocialMediaGeneration,
  SocialNetwork,
  GeneratedPost,
  AiDetectionScore,
} from '../../../domain/entities/social-media-generation.entity';

type PrismaSocialMediaGeneration = Prisma.SocialMediaGenerationGetPayload<{}>;

/**
 * Snapshot shape coming from SocialMediaGenerationAggregate.toSnapshot().
 * Same fields as the plain SocialMediaGeneration interface.
 */
type SocialMediaSnapshot = SocialMediaGeneration;

export class SocialMediaMapper {
  static toDomain(row: PrismaSocialMediaGeneration): SocialMediaGeneration {
    return {
      id: row.id,
      userId: row.userId,
      niche: row.niche,
      topicTitle: row.topicTitle,
      topicDescription: row.topicDescription,
      language: row.language,
      networks: (row.networks ?? {}) as Partial<Record<SocialNetwork, boolean>>,
      generatedPosts: (row.generatedPosts ?? {}) as Partial<
        Record<SocialNetwork, GeneratedPost>
      >,
      r2Key: row.r2Key,
      viralityScore: row.viralityScore,
      roiScore: row.roiScore,
      // Prisma stores JSON as InputJsonValue; cast to domain type for read model
      aiDetectionScore: row.aiDetectionScore as AiDetectionScore | null,
      analysisReportKey: row.analysisReportKey,
      analysisReportUrl: row.analysisReportUrl,
      createdAt: row.createdAt,
      qualityScores: row.qualityScores as {
        human_writing_index: number;
        virality_score: number;
        engagement_score: number;
        roi_score: number;
        trend_alignment: number;
      } | null,
      qualityWarning: row.qualityWarning,
      iterationsRequired: row.iterationsRequired,
    };
  }

  static toPersistence(
    snapshot: SocialMediaSnapshot,
  ): Prisma.SocialMediaGenerationUncheckedCreateInput {
    return {
      id: snapshot.id,
      userId: snapshot.userId,
      niche: snapshot.niche,
      topicTitle: snapshot.topicTitle,
      topicDescription: snapshot.topicDescription ?? null,
      language: snapshot.language ?? null,
      networks: snapshot.networks,
      // Prisma requires InputJsonValue for JSON columns; domain object must be serialized
      generatedPosts: snapshot.generatedPosts as Prisma.InputJsonValue,
      r2Key: snapshot.r2Key ?? null,
      viralityScore: snapshot.viralityScore ?? null,
      roiScore: snapshot.roiScore ?? null,
      // Prisma requires InputJsonValue for JSON columns; serialize domain object for storage
      aiDetectionScore: snapshot.aiDetectionScore
        ? (JSON.parse(
            JSON.stringify(snapshot.aiDetectionScore),
          ) as Prisma.InputJsonValue)
        : null,
      qualityScores: snapshot.qualityScores
        ? (JSON.parse(
            JSON.stringify(snapshot.qualityScores),
          ) as Prisma.InputJsonValue)
        : null,
      qualityWarning: snapshot.qualityWarning ?? false,
      iterationsRequired: snapshot.iterationsRequired ?? 1,
      analysisReportKey: snapshot.analysisReportKey ?? null,
      analysisReportUrl: snapshot.analysisReportUrl ?? null,
      createdAt: snapshot.createdAt,
    } as Prisma.SocialMediaGenerationUncheckedCreateInput;
  }

  static toUpdate(
    snapshot: SocialMediaSnapshot,
  ): Prisma.SocialMediaGenerationUncheckedUpdateInput {
    return {
      viralityScore: snapshot.viralityScore ?? null,
      roiScore: snapshot.roiScore ?? null,
      // Prisma requires InputJsonValue for JSON columns; serialize domain object for storage
      aiDetectionScore: snapshot.aiDetectionScore
        ? (JSON.parse(
            JSON.stringify(snapshot.aiDetectionScore),
          ) as Prisma.InputJsonValue)
        : null,
      analysisReportKey: snapshot.analysisReportKey ?? null,
      analysisReportUrl: snapshot.analysisReportUrl ?? null,
    } as Prisma.SocialMediaGenerationUncheckedUpdateInput;
  }
}
