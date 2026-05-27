import { CampaignGeneration } from '../entities/campaign-generation.aggregate';
import { StageExportResult } from '../value-objects/stage-export-result.vo';

/**
 * Repository Port for CampaignGeneration aggregate.
 * Implemented by Prisma adapter in infrastructure.
 */
export interface ICampaignGenerationRepository {
  /**
   * Persist a new aggregate (insert) or update existing one.
   * Must also persist attached stage results.
   *
   * On create (when aggregate.id is null/undefined), returns the newly generated ID.
   * On update, returns undefined.
   */
  save(aggregate: CampaignGeneration): Promise<string | undefined>;

  /**
   * Find by primary key. Returns null if not found or soft-deleted.
   */
  findById(
    id: string,
    withTrashed?: boolean,
  ): Promise<CampaignGeneration | null>;

  /**
   * List generations for a user (most recent first), supports pagination.
   */
  findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number; withTrashed?: boolean },
  ): Promise<CampaignGeneration[]>;

  /**
   * Soft delete (sets deletedAt).
   */
  softDelete(id: string): Promise<void>;

  /**
   * Optimized query for export (CSV/XLSX/PDF of the generation list).
   * Returns a flat projection without full stage results for performance.
   */
  findForExport(
    userId: string,
    filters?: { status?: string; from?: Date; to?: Date },
  ): Promise<
    Array<{
      id: string;
      userId: string;
      companyNameSnapshot: string;
      niche: string;
      location: string;
      phone: string;
      status: string;
      stages: string[];
      format: string;
      durationSeconds: number;
      language: string;
      generateImages: boolean;
      createdAt: Date;
      updatedAt: Date;
      errorMessage: string | null;
    }>
  >;
}

export const CAMPAIGN_GENERATION_REPOSITORY = Symbol(
  'ICampaignGenerationRepository',
);
