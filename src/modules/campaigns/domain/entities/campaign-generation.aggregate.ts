import { FunnelStage } from '../value-objects/funnel-stage.vo';
import { VideoFormat } from '../value-objects/video-format.vo';
import {
  CampaignStatus,
  CampaignStatusVO,
} from '../value-objects/campaign-status.vo';
import { StageExportResult } from '../value-objects/stage-export-result.vo';
import {
  CampaignGenerationNotFoundException,
  InvalidCampaignStatusTransitionException,
} from '../exceptions/campaign-domain.exception';
import { CampaignExportRequestedEvent } from '../events/campaign-export-requested.event';

/**
 * Rich Domain Aggregate for a Campaign Video Export Generation request.
 *
 * Now uses CompanyData relation:
 * - companyDataId: the source of truth at request time
 * - companyNameSnapshot: immutable copy of the company name for this export
 */
export interface AiDetectionScore {
  aiGenerated: number;
  aiParaphrased: number;
  humanWritten: number;
  showsAiSigns: number;
}

export interface CampaignGenerationProps {
  id?: string;
  userId: string;
  companyDataId: string;
  companyNameSnapshot: string;
  niche: string;
  location: string;
  phone: string;
  website?: string;
  stages: FunnelStage[];
  format: VideoFormat;
  durationSeconds: 15 | 20;
  language: string;
  generateImages: boolean;
  aiObservations?: string | null;
  viralityScore?: number | null;
  roiScore?: number | null;
  aiDetectionScore?: AiDetectionScore | null;
  analysisReportKey?: string | null;
  analysisReportUrl?: string | null;
  status?: CampaignStatus;
  errorMessage?: string | null;
  stageResults?: StageExportResult[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class CampaignGeneration {
  private constructor(
    public readonly id: string | null,
    public readonly userId: string,
    public readonly companyDataId: string,
    public readonly companyNameSnapshot: string,
    public readonly niche: string,
    public readonly location: string,
    public readonly phone: string,
    public readonly website: string | null,
    public readonly stages: readonly FunnelStage[],
    public readonly format: VideoFormat,
    public readonly durationSeconds: 15 | 20,
    public readonly language: string,
    public readonly generateImages: boolean,
    public readonly aiObservations: string | null,
    private _viralityScore: number | null,
    private _roiScore: number | null,
    private _aiDetectionScore: AiDetectionScore | null,
    private _analysisReportKey: string | null,
    private _analysisReportUrl: string | null,
    private _status: CampaignStatusVO,
    private _errorMessage: string | null,
    private readonly _stageResults: StageExportResult[],
    public readonly createdAt: Date,
    private _updatedAt: Date,
    private readonly _domainEvents: unknown[] = [],
  ) {}

  // ─── Factory ────────────────────────────────────────────────────────────────

  static create(props: CampaignGenerationProps): CampaignGeneration {
    if (!props.stages || props.stages.length === 0) {
      throw new Error('At least one funnel stage is required');
    }
    if (!props.companyDataId) {
      throw new Error('companyDataId is required');
    }
    if (!props.companyNameSnapshot) {
      throw new Error(
        'companyNameSnapshot is required (must be resolved from CompanyData)',
      );
    }

    const now = new Date();

    const aggregate = new CampaignGeneration(
      props.id ?? null,
      props.userId,
      props.companyDataId,
      props.companyNameSnapshot,
      props.niche,
      props.location,
      props.phone,
      props.website ?? null,
      [...props.stages],
      props.format,
      props.durationSeconds,
      props.language ?? 'es',
      props.generateImages ?? false,
      props.aiObservations ?? null,
      props.viralityScore ?? null,
      props.roiScore ?? null,
      props.aiDetectionScore ?? null,
      null,
      null,
      props.status
        ? CampaignStatusVO.create(props.status)
        : CampaignStatusVO.pending(),
      props.errorMessage ?? null,
      props.stageResults ?? [],
      props.createdAt ?? now,
      props.updatedAt ?? now,
      [],
    );

    if (!props.id) {
      aggregate.addDomainEvent(
        new CampaignExportRequestedEvent('pending', props.userId, {
          companyDataId: props.companyDataId,
          companyNameSnapshot: props.companyNameSnapshot,
          niche: props.niche,
          location: props.location,
          phone: props.phone,
          website: props.website,
          stages: props.stages,
          format: props.format,
          durationSeconds: props.durationSeconds,
          language: props.language ?? 'es',
          generateImages: props.generateImages ?? false,
          aiObservations: props.aiObservations ?? undefined,
        }),
      );
    }

    return aggregate;
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  get status(): CampaignStatus {
    return this._status.value;
  }

  get viralityScore(): number | null {
    return this._viralityScore;
  }

  get roiScore(): number | null {
    return this._roiScore;
  }

  get aiDetectionScore(): AiDetectionScore | null {
    return this._aiDetectionScore;
  }

  get analysisReportKey(): string | null {
    return this._analysisReportKey;
  }

  get analysisReportUrl(): string | null {
    return this._analysisReportUrl;
  }

  get errorMessage(): string | null {
    return this._errorMessage;
  }

  get stageResults(): readonly StageExportResult[] {
    return [...this._stageResults];
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get domainEvents(): readonly unknown[] {
    return [...this._domainEvents];
  }

  // ─── Behavior ───────────────────────────────────────────────────────────────

  markProcessing(): void {
    const next = CampaignStatusVO.processing();
    if (!this._status.canTransitionTo(next)) {
      throw new InvalidCampaignStatusTransitionException(
        this.status,
        next.value,
      );
    }
    this._status = next;
    this.touch();
  }

  attachStageResult(result: StageExportResult): void {
    const idx = this._stageResults.findIndex((r) => r.stage === result.stage);
    if (idx >= 0) {
      this._stageResults[idx] = result;
    } else {
      this._stageResults.push(result);
    }
    this.touch();
  }

  complete(): void {
    const next = CampaignStatusVO.completed();
    if (!this._status.canTransitionTo(next)) {
      throw new InvalidCampaignStatusTransitionException(
        this.status,
        next.value,
      );
    }

    const hasFailures = this._stageResults.some((r) => r.isFailure());
    const hasSuccesses = this._stageResults.some((r) => r.isSuccess());

    if (hasFailures && hasSuccesses) {
      this._status = CampaignStatusVO.partial();
    } else if (hasFailures) {
      this._status = CampaignStatusVO.failed();
      this._errorMessage = this._errorMessage ?? 'All stages failed';
    } else {
      this._status = next;
    }

    this.touch();
  }

  setViralityScore(score: number): void {
    this._viralityScore = score;
    this.touch();
  }

  setRoiScore(score: number): void {
    this._roiScore = score;
    this.touch();
  }

  setAiDetectionScore(score: AiDetectionScore): void {
    this._aiDetectionScore = score;
    this.touch();
  }

  setAnalysisReport(key: string, url: string): void {
    this._analysisReportKey = key;
    this._analysisReportUrl = url;
    this.touch();
  }

  fail(reason: string): void {
    this._status = CampaignStatusVO.failed();
    this._errorMessage = reason;
    this.touch();
  }

  private addDomainEvent(event: unknown): void {
    (this._domainEvents as unknown[]).push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents.length = 0;
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  // ─── Reconstruction ─────────────────────────────────────────────────────────

  static reconstitute(
    props: CampaignGenerationProps & { id: string },
  ): CampaignGeneration {
    return new CampaignGeneration(
      props.id,
      props.userId,
      props.companyDataId,
      props.companyNameSnapshot,
      props.niche,
      props.location,
      props.phone,
      props.website ?? null,
      [...props.stages],
      props.format,
      props.durationSeconds,
      props.language ?? 'es',
      props.generateImages ?? false,
      props.aiObservations ?? null,
      props.viralityScore ?? null,
      props.roiScore ?? null,
      props.aiDetectionScore ?? null,
      props.analysisReportKey ?? null,
      props.analysisReportUrl ?? null,
      CampaignStatusVO.create(props.status ?? 'pending'),
      props.errorMessage ?? null,
      props.stageResults ?? [],
      props.createdAt ?? new Date(),
      props.updatedAt ?? new Date(),
      [],
    );
  }
}
