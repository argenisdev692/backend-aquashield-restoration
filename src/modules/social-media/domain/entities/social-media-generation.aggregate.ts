import {
  SocialNetwork,
  GeneratedPost,
  GeneratedPostImage,
} from './social-media-generation.entity';
import { SocialNetworkVO } from '../value-objects/social-network.vo';
import { SocialMediaGenerationDomainException } from '../exceptions/social-media-generation-domain.exception';

/**
 * AI Detection Score for social media posts.
 */
export interface AiDetectionScore {
  aiGenerated: number;
  aiParaphrased: number;
  humanWritten: number;
  showsAiSigns: number;
}

/**
 * Rich Domain Aggregate: SocialMediaGenerationAggregate
 *
 * Encapsulates business rules and invariants for a social media post generation record.
 * - Private state (no direct mutation from outside)
 * - Static factory `create()` with validation
 * - Behavior methods (e.g., addGeneratedPost, canBeDeletedBy)
 * - Zero NestJS / Prisma / infrastructure dependencies
 */
export class SocialMediaGenerationAggregate {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _niche: string,
    private readonly _topicTitle: string,
    private readonly _topicDescription: string | null,
    private readonly _language: string | null,
    private readonly _networks: Map<SocialNetwork, boolean>,
    private readonly _generatedPosts: Map<SocialNetwork, GeneratedPost>,
    private readonly _r2Key: string | null,
    private _viralityScore: number | null,
    private _roiScore: number | null,
    private _aiDetectionScore: AiDetectionScore | null,
    private _analysisReportKey: string | null,
    private _analysisReportUrl: string | null,
    private readonly _createdAt: Date,
    private _qualityScores: {
      human_writing_index: number;
      virality_score: number;
      engagement_score: number;
      roi_score: number;
      trend_alignment: number;
    } | null,
    private _qualityWarning: boolean,
    private _iterationsRequired: number,
  ) {}

  // ── Factory ────────────────────────────────────────────────────────────────

  static create(params: {
    id?: string;
    userId: string;
    niche: string;
    topicTitle: string;
    topicDescription?: string | null;
    language?: string | null;
    networks: Partial<Record<SocialNetwork, boolean>>;
    generatedPosts?: Partial<Record<SocialNetwork, GeneratedPost>>;
    r2Key?: string | null;
    viralityScore?: number | null;
    roiScore?: number | null;
    aiDetectionScore?: AiDetectionScore | null;
    analysisReportKey?: string | null;
    analysisReportUrl?: string | null;
    createdAt?: Date;
    qualityScores?: {
      human_writing_index: number;
      virality_score: number;
      engagement_score: number;
      roi_score: number;
      trend_alignment: number;
    } | null;
    qualityWarning?: boolean;
    iterationsRequired?: number;
  }): SocialMediaGenerationAggregate {
    const id = params.id ?? crypto.randomUUID();

    if (!params.userId || params.userId.trim().length === 0) {
      throw new SocialMediaGenerationDomainException('userId is required');
    }
    if (!params.niche || params.niche.trim().length === 0) {
      throw new SocialMediaGenerationDomainException('niche is required');
    }
    if (!params.topicTitle || params.topicTitle.trim().length < 3) {
      throw new SocialMediaGenerationDomainException(
        'topicTitle must be at least 3 characters',
      );
    }

    // Invariant: at least one network must be selected
    const activeNetworks = Object.entries(params.networks).filter(
      ([, v]) => v === true,
    );
    if (activeNetworks.length === 0) {
      throw new SocialMediaGenerationDomainException(
        'At least one social network must be selected',
      );
    }

    const networksMap = new Map<SocialNetwork, boolean>();
    for (const [net, active] of Object.entries(params.networks)) {
      if (active) {
        networksMap.set(net as SocialNetwork, true);
      }
    }

    const postsMap = new Map<SocialNetwork, GeneratedPost>();
    if (params.generatedPosts) {
      for (const [net, post] of Object.entries(params.generatedPosts)) {
        if (post && networksMap.has(net as SocialNetwork)) {
          postsMap.set(net as SocialNetwork, post);
        }
      }
    }

    return new SocialMediaGenerationAggregate(
      id,
      params.userId,
      params.niche,
      params.topicTitle,
      params.topicDescription ?? null,
      params.language ?? null,
      networksMap,
      postsMap,
      params.r2Key ?? null,
      params.viralityScore ?? null,
      params.roiScore ?? null,
      params.aiDetectionScore ?? null,
      params.analysisReportKey ?? null,
      params.analysisReportUrl ?? null,
      params.createdAt ?? new Date(),
      params.qualityScores ?? null,
      params.qualityWarning ?? false,
      params.iterationsRequired ?? 1,
    );
  }

  // ── Accessors (read-only) ──────────────────────────────────────────────────

  get id(): string {
    return this._id;
  }

  get userId(): string {
    return this._userId;
  }

  get niche(): string {
    return this._niche;
  }

  get topicTitle(): string {
    return this._topicTitle;
  }

  get topicDescription(): string | null {
    return this._topicDescription;
  }

  get language(): string | null {
    return this._language;
  }

  get networks(): Partial<Record<SocialNetwork, boolean>> {
    const result: Partial<Record<SocialNetwork, boolean>> = {};
    for (const [net, active] of this._networks.entries()) {
      result[net] = active;
    }
    return result;
  }

  get generatedPosts(): Partial<Record<SocialNetwork, GeneratedPost>> {
    const result: Partial<Record<SocialNetwork, GeneratedPost>> = {};
    for (const [net, post] of this._generatedPosts.entries()) {
      result[net] = post;
    }
    return result;
  }

  get r2Key(): string | null {
    return this._r2Key;
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

  get createdAt(): Date {
    return this._createdAt;
  }

  get qualityScores(): {
    human_writing_index: number;
    virality_score: number;
    engagement_score: number;
    roi_score: number;
    trend_alignment: number;
  } | null {
    return this._qualityScores;
  }

  get qualityWarning(): boolean {
    return this._qualityWarning;
  }

  get iterationsRequired(): number {
    return this._iterationsRequired;
  }

  // ── Behavior / Invariants ──────────────────────────────────────────────────

  /**
   * Returns true if the given user is allowed to delete this record.
   * Current rule (ABAC-enforced at controller): only the owner or users with Delete permission.
   * Aggregate only encodes the ownership check here.
   */
  canBeDeletedBy(actorUserId: string): boolean {
    return this._userId === actorUserId;
  }

  /**
   * Returns the list of active networks as value objects (for type-safe iteration).
   */
  getActiveNetworks(): SocialNetworkVO[] {
    return Array.from(this._networks.keys()).map((n) =>
      SocialNetworkVO.create(n),
    );
  }

  /**
   * Adds or updates a generated post for a network.
   * Enforces that the network was selected for this generation.
   */
  addGeneratedPost(network: SocialNetwork, post: GeneratedPost): void {
    if (!this._networks.has(network)) {
      throw new SocialMediaGenerationDomainException(
        `Cannot add post for network "${network}" that was not selected for generation`,
      );
    }
    this._generatedPosts.set(network, post);
  }

  /**
   * Attaches the same image to all generated posts (used by image generation step).
   */
  attachSharedImage(image: GeneratedPostImage): void {
    for (const [net, post] of this._generatedPosts.entries()) {
      this._generatedPosts.set(net, { ...post, image });
    }
  }

  /**
   * Sets the virality score from Tavily research.
   */
  setViralityScore(score: number): void {
    this._viralityScore = score;
  }

  /**
   * Sets the ROI score from Tavily research.
   */
  setRoiScore(score: number): void {
    this._roiScore = score;
  }

  /**
   * Sets the AI detection score from content analysis.
   */
  setAiDetectionScore(score: AiDetectionScore): void {
    this._aiDetectionScore = score;
  }

  /**
   * Sets the analysis report key and URL after PDF generation.
   */
  setAnalysisReport(key: string, url: string): void {
    this._analysisReportKey = key;
    this._analysisReportUrl = url;
  }

  // ── Serialization for persistence boundary ─────────────────────────────────

  toSnapshot(): {
    id: string;
    userId: string;
    niche: string;
    topicTitle: string;
    topicDescription: string | null;
    language: string | null;
    networks: Partial<Record<SocialNetwork, boolean>>;
    generatedPosts: Partial<Record<SocialNetwork, GeneratedPost>>;
    r2Key: string | null;
    viralityScore: number | null;
    roiScore: number | null;
    aiDetectionScore: AiDetectionScore | null;
    analysisReportKey: string | null;
    analysisReportUrl: string | null;
    createdAt: Date;
    qualityScores: {
      human_writing_index: number;
      virality_score: number;
      engagement_score: number;
      roi_score: number;
      trend_alignment: number;
    } | null;
    qualityWarning: boolean;
    iterationsRequired: number;
  } {
    return {
      id: this._id,
      userId: this._userId,
      niche: this._niche,
      topicTitle: this._topicTitle,
      topicDescription: this._topicDescription,
      language: this._language,
      networks: this.networks,
      generatedPosts: this.generatedPosts,
      r2Key: this._r2Key,
      viralityScore: this._viralityScore,
      roiScore: this._roiScore,
      aiDetectionScore: this._aiDetectionScore,
      analysisReportKey: this._analysisReportKey,
      analysisReportUrl: this._analysisReportUrl,
      createdAt: this._createdAt,
      qualityScores: this._qualityScores,
      qualityWarning: this._qualityWarning,
      iterationsRequired: this._iterationsRequired,
    };
  }
}
