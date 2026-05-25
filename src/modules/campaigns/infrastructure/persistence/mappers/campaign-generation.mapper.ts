import { CampaignGenerationStatus } from '../../../../../generated/prisma/client';
import { CampaignGeneration } from '../../../domain/entities/campaign-generation.aggregate';
import { FunnelStage } from '../../../domain/value-objects/funnel-stage.vo';
import { VideoFormat } from '../../../domain/value-objects/video-format.vo';
import { VideoFormatVO } from '../../../domain/value-objects/video-format.vo';
import { StageExportResult } from '../../../domain/value-objects/stage-export-result.vo';
import { CampaignStatusVO } from '../../../domain/value-objects/campaign-status.vo';

/**
 * Maps between the rich CampaignGeneration aggregate and Prisma rows.
 * This is the anti-corruption layer between domain and persistence.
 */
export class CampaignGenerationMapper {
  /**
   * Converts a Prisma row (with nested stageExports) into a hydrated aggregate.
   */
  static toDomain(row: {
    id: string;
    userId: string;
    companyDataId: string;
    companyNameSnapshot: string;
    niche: string;
    location: string;
    phone: string;
    website: string | null;
    stages: unknown;
    format: string;
    durationSeconds: number;
    language: string;
    generateImages: boolean;
    status: string;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
    stageExports?: Array<{
      stage: string;
      zipKey: string | null;
      zipUrl: string | null;
      sizeBytes: bigint | null;
      error: string | null;
    }>;
  }): CampaignGeneration {
    const stages = (row.stages as string[]).map((s) => s as FunnelStage);

    const stageResults =
      row.stageExports?.map((se) =>
        StageExportResult.fromPrisma({
          stage: se.stage,
          zipKey: se.zipKey,
          zipUrl: se.zipUrl,
          sizeBytes: se.sizeBytes,
          error: se.error,
        }),
      ) ?? [];

    return CampaignGeneration.reconstitute({
      id: row.id,
      userId: row.userId,
      companyDataId: row.companyDataId,
      companyNameSnapshot: row.companyNameSnapshot,
      niche: row.niche,
      location: row.location,
      phone: row.phone,
      website: row.website ?? undefined,
      stages,
      format: VideoFormatVO.fromString(row.format).value,
      durationSeconds: row.durationSeconds as 15 | 20, // validated at aggregate level + DB constraint
      language: row.language,
      generateImages: row.generateImages,
      status: CampaignStatusVO.create(row.status).value,
      errorMessage: row.errorMessage ?? undefined,
      stageResults,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /**
   * Converts an aggregate into the shape expected by Prisma create/update.
   * Note: stageExports are handled separately in the repository for simplicity.
   */
  static toPersistence(aggregate: CampaignGeneration): {
    id?: string;
    userId: string;
    companyDataId: string;
    companyNameSnapshot: string;
    niche: string;
    location: string;
    phone: string;
    website: string | null;
    stages: FunnelStage[];
    format: VideoFormat;
    durationSeconds: 15 | 20;
    language: string;
    generateImages: boolean;
    status: CampaignGenerationStatus;
    errorMessage: string | null;
  } {
    return {
      id: aggregate.id ?? undefined,
      userId: aggregate.userId,
      companyDataId: aggregate.companyDataId,
      companyNameSnapshot: aggregate.companyNameSnapshot,
      niche: aggregate.niche,
      location: aggregate.location,
      phone: aggregate.phone,
      website: aggregate.website,
      stages: [...aggregate.stages] as FunnelStage[],
      format: aggregate.format as VideoFormat,
      durationSeconds: aggregate.durationSeconds,
      language: aggregate.language,
      generateImages: aggregate.generateImages,
      status: aggregate.status as CampaignGenerationStatus,
      errorMessage: aggregate.errorMessage,
    };
  }
}
