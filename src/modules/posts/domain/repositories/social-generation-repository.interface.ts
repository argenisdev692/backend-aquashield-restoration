import type { SocialPostPackage } from '../value-objects/social-post-package.vo';

export const SOCIAL_GENERATION_REPOSITORY = Symbol(
  'SocialGenerationRepository',
);

export interface PersistSocialGenerationInput {
  userId: string;
  niche: string;
  topicTitle: string;
  topicDescription: string | null;
  networks: string[];
  pkg: SocialPostPackage;
}

/** Persisted social generation row (read model for the ZIP export). */
export interface SocialGenerationRecord {
  id: string;
  userId: string;
  niche: string;
  topicTitle: string;
  networks: string[];
  pkg: SocialPostPackage;
  qualityWarning: boolean;
  iterationsRequired: number;
  createdAt: Date;
}

export interface ISocialGenerationRepository {
  /** Persists a generated package and returns the new row id. */
  create(input: PersistSocialGenerationInput): Promise<string>;
  /** Returns the record or null if it does not exist. */
  findById(id: string): Promise<SocialGenerationRecord | null>;
}
