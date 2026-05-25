import type { Prisma } from '../../../../../generated/prisma/client';
import type {
  SocialMediaGeneration,
  SocialNetwork,
  GeneratedPost,
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
      createdAt: row.createdAt,
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
      networks: snapshot.networks as Prisma.InputJsonValue,
      generatedPosts: snapshot.generatedPosts as Prisma.InputJsonValue,
      r2Key: snapshot.r2Key ?? null,
      createdAt: snapshot.createdAt,
    };
  }
}
