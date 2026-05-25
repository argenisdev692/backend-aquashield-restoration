import { z } from 'zod';
import { FunnelStage, FunnelStageSchema } from './funnel-stage.vo';
import { VideoFormat, VideoFormatSchema } from './video-format.vo';

/**
 * DTO-like shape for a single stage export result inside the aggregate.
 * This is a Value Object (immutable).
 */
export interface StageExportResultProps {
  stage: FunnelStage;
  zipKey?: string | null;
  zipUrl?: string | null;
  sizeBytes?: number | null;
  error?: string | null; // explicitly allow null (means "no error")
}

export const StageExportResultSchema = z.object({
  stage: FunnelStageSchema,
  zipKey: z.string().nullable().optional(),
  zipUrl: z.string().url().nullable().optional(),
  sizeBytes: z.coerce.number().int().nonnegative().nullable().optional(),
  error: z.string().nullable().optional(),
});

export class StageExportResult {
  private constructor(
    public readonly stage: FunnelStage,
    public readonly zipKey: string | null,
    public readonly zipUrl: string | null,
    public readonly sizeBytes: number | null,
    public readonly error: string | null,
  ) {}

  static create(props: StageExportResultProps): StageExportResult {
    const parsed = StageExportResultSchema.parse(props);
    return new StageExportResult(
      parsed.stage,
      parsed.zipKey ?? null,
      parsed.zipUrl ?? null,
      parsed.sizeBytes ?? null,
      parsed.error ?? null,
    );
  }

  static fromPrisma(row: {
    stage: string;
    zipKey: string | null;
    zipUrl: string | null;
    sizeBytes: bigint | null;
    error: string | null;
  }): StageExportResult {
    return new StageExportResult(
      row.stage as FunnelStage,
      row.zipKey,
      row.zipUrl,
      row.sizeBytes ? Number(row.sizeBytes) : null,
      row.error,
    );
  }

  isSuccess(): boolean {
    return !!this.zipKey && !this.error;
  }

  isFailure(): boolean {
    return !!this.error;
  }

  toPrisma(): {
    stage: FunnelStage;
    zipKey: string | null;
    zipUrl: string | null;
    sizeBytes: bigint | null;
    error: string | null;
  } {
    return {
      stage: this.stage,
      zipKey: this.zipKey,
      zipUrl: this.zipUrl,
      sizeBytes: this.sizeBytes !== null ? BigInt(this.sizeBytes) : null,
      error: this.error,
    };
  }
}
