import type {
  SocialNetwork,
  GeneratedPost,
} from '../../domain/entities/social-media-generation.entity';

/**
 * Read Model for Social Media Generation (used in list, get-by-id, export).
 * Optimized shape for queries — denormalized, no behavior.
 * Fields marked for export use @ExportColumn in future if needed.
 */
export interface SocialMediaGenerationReadModel {
  id: string;
  userId: string;
  niche: string;
  topicTitle: string;
  topicDescription: string | null;
  language: string | null;
  networks: Partial<Record<SocialNetwork, boolean>>;
  generatedPosts: Partial<Record<SocialNetwork, GeneratedPost>>;
  r2Key: string | null;
  createdAt: string; // ISO string for API responses
}
