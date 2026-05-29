import type { SocialMediaGeneration } from '../entities/social-media-generation.entity';
import type { SocialMediaGenerationAggregate } from '../entities/social-media-generation.aggregate';
import type { DateRange } from '../../../../shared/crud/date-range.util';

export const SOCIAL_MEDIA_REPOSITORY = Symbol('ISocialMediaRepository');

export interface SocialMediaFilters {
  userId?: string;
  niche?: string;
  language?: string;
  network?: string; // facebook | instagram | tiktok | linkedin | twitter
  dateRange?: DateRange;
}

export interface PaginatedSocialMediaGenerations {
  data: SocialMediaGeneration[];
  total: number;
  page: number;
  limit: number;
}

export interface ISocialMediaRepository {
  /**
   * Saves a rich Aggregate (write path).
   * The implementation extracts the snapshot and persists it.
   */
  save(
    aggregate: SocialMediaGenerationAggregate,
  ): Promise<SocialMediaGeneration>;

  /**
   * Updates an existing aggregate (write path for partial updates).
   */
  update(
    aggregate: SocialMediaGenerationAggregate,
  ): Promise<SocialMediaGeneration>;

  /**
   * Reads return the plain data shape (sufficient for read models / presenters).
   */
  findById(id: string): Promise<SocialMediaGeneration | null>;
  findAll(
    filters: SocialMediaFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedSocialMediaGenerations>;
  delete(id: string): Promise<void>;
  bulkDelete(ids: string[]): Promise<{ count: number }>;
  countByUser(userId: string): Promise<number>;
}
