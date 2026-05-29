import type { SocialPostScores } from './social-post-scores.vo';
import type { Source } from './research-result.vo';

/**
 * Step 2 output: the complete, multi-platform social-media content package.
 * Pure domain VO — assembled by the AI adapter, enriched with R2 image URLs and
 * a persisted id by the processor before it reaches the client.
 */

export interface PostContent {
  headline: string;
  body: string;
  callToAction: string;
  hashtags: string[];
}

export interface PlatformVariation {
  platform: string;
  adaptedContent: string;
  /** Present for char-bounded platforms (linkedin/twitter/facebook). */
  characterCount: number | null;
  /** Present for prose platforms (blog/newsletter). */
  wordCount: number | null;
  hashtags: string[];
  imagePrompt: string;
  coverImageUrl: string | null;
  /** Newsletter-only. */
  subjectLine: string | null;
  previewText: string | null;
  /** Twitter/X-only. */
  isThread: boolean;
  threadTweets: string[];
}

export interface CoverImage {
  mainPrompt: string;
  style: string;
  colorPalette: string[];
  mood: string;
  keyElements: string[];
  mainImageUrl: string | null;
}

export interface SeoMetadata {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  ogType: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImageUrl: string;
  canonicalUrl: string;
  schemaJsonLd: Record<string, unknown>;
}

export interface EeatAnalysis {
  experienceSignals: string[];
  expertiseSignals: string[];
  authoritativenessSignals: string[];
  trustworthinessSignals: string[];
}

export interface SeoAnalysis {
  primaryKeyword: string;
  lsiKeywords: string[];
  technicalFactors: string[];
  semanticFactors: string[];
  machineReadability: string[];
}

export interface AiDetectionRisk {
  value: number;
  label: string;
  explanation: string;
}

export interface PackageMetadata {
  iterationsRequired: number;
  qualityWarning: boolean;
  qualityWarningMessage: string | null;
  aiModel: string;
  tavilySearchesPerformed: number;
  aiGeneratedAt: string;
}

export class SocialPostPackage {
  constructor(
    public readonly postContent: PostContent,
    public readonly platformVariations: PlatformVariation[],
    public readonly coverImage: CoverImage,
    public readonly scores: SocialPostScores,
    public readonly seoMetadata: SeoMetadata,
    public readonly eeatAnalysis: EeatAnalysis,
    public readonly seoAnalysis: SeoAnalysis,
    public readonly optimizationSuggestions: string[],
    public readonly researchSources: Source[],
    public readonly aiDetectionRisk: AiDetectionRisk,
    public readonly metadata: PackageMetadata,
  ) {}

  /** Returns a copy with final iteration metadata (immutable update). */
  withMetadata(metadata: PackageMetadata): SocialPostPackage {
    return new SocialPostPackage(
      this.postContent,
      this.platformVariations,
      this.coverImage,
      this.scores,
      this.seoMetadata,
      this.eeatAnalysis,
      this.seoAnalysis,
      this.optimizationSuggestions,
      this.researchSources,
      this.aiDetectionRisk,
      metadata,
    );
  }

  /** Returns a copy with image URLs attached (immutable update). */
  withImages(
    platformImageUrls: Record<string, string | null>,
    mainImageUrl: string | null,
  ): SocialPostPackage {
    return new SocialPostPackage(
      this.postContent,
      this.platformVariations.map((v) => ({
        ...v,
        coverImageUrl: platformImageUrls[v.platform] ?? v.coverImageUrl,
      })),
      { ...this.coverImage, mainImageUrl },
      this.scores,
      this.seoMetadata,
      this.eeatAnalysis,
      this.seoAnalysis,
      this.optimizationSuggestions,
      this.researchSources,
      this.aiDetectionRisk,
      this.metadata,
    );
  }
}
