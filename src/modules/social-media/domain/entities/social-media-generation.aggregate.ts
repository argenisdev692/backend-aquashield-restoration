import { SocialNetwork, GeneratedPost, GeneratedPostImage } from './social-media-generation.entity';
import { SocialNetworkVO } from '../value-objects/social-network.vo';

/**
 * Domain Exception for Social Media Generation invariants.
 */
export class SocialMediaGenerationDomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SocialMediaGenerationDomainException';
  }
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
    private readonly _createdAt: Date,
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
    createdAt?: Date;
  }): SocialMediaGenerationAggregate {
    const id = params.id ?? crypto.randomUUID();

    if (!params.userId || params.userId.trim().length === 0) {
      throw new SocialMediaGenerationDomainException('userId is required');
    }
    if (!params.niche || params.niche.trim().length === 0) {
      throw new SocialMediaGenerationDomainException('niche is required');
    }
    if (!params.topicTitle || params.topicTitle.trim().length < 3) {
      throw new SocialMediaGenerationDomainException('topicTitle must be at least 3 characters');
    }

    // Invariant: at least one network must be selected
    const activeNetworks = Object.entries(params.networks).filter(([, v]) => v === true);
    if (activeNetworks.length === 0) {
      throw new SocialMediaGenerationDomainException('At least one social network must be selected');
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
      params.createdAt ?? new Date(),
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

  get createdAt(): Date {
    return this._createdAt;
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
    return Array.from(this._networks.keys()).map((n) => SocialNetworkVO.create(n));
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
    createdAt: Date;
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
      createdAt: this._createdAt,
    };
  }
}
