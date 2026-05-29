import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import type { SocialGenerationResult } from '../../../application/social/social-generation.util';
import type {
  SocialPostPackage,
  PlatformVariation,
} from '../../../domain/value-objects/social-post-package.vo';
import {
  SCORE_THRESHOLDS,
  evaluateScores,
  type QualityScore,
} from '../../../domain/value-objects/social-post-scores.vo';

const scoreSchema = z.object({
  value: z.number(),
  threshold: z.number(),
  passes: z.boolean(),
  factors: z.array(z.string()),
  explanation: z.string(),
});

const variationSchema = z.object({
  adapted_content: z.string(),
  character_count: z.number().nullable(),
  word_count: z.number().nullable(),
  hashtags: z.array(z.string()),
  image_prompt: z.string(),
  cover_image_url: z.string().nullable(),
  subject_line: z.string().nullable(),
  preview_text: z.string().nullable(),
  is_thread: z.boolean(),
  thread_tweets: z.array(z.string()),
});

export const GenerateSocialPostResponseSchema = z.object({
  id: z.string(),
  post_content: z.object({
    headline: z.string(),
    body: z.string(),
    call_to_action: z.string(),
    hashtags: z.array(z.string()),
  }),
  platform_variations: z.object({
    blog: variationSchema,
    linkedin: variationSchema,
    twitter: variationSchema,
    newsletter: variationSchema,
    facebook: variationSchema,
  }),
  cover_image: z.object({
    main_prompt: z.string(),
    main_image_url: z.string().nullable(),
    style: z.string(),
    color_palette: z.array(z.string()),
    mood: z.string(),
    key_elements: z.array(z.string()),
  }),
  scores: z.object({
    human_writing_index: scoreSchema,
    // Alias kept for the existing frontend, which reads `human_likeness_score`.
    human_likeness_score: scoreSchema,
    eeat_score: scoreSchema,
    virality_score: scoreSchema,
    roi_score: scoreSchema,
    seo_score: scoreSchema,
    ai_detection_risk: z.object({
      value: z.number(),
      label: z.string(),
      explanation: z.string(),
    }),
    summary: z.object({
      all_pass: z.boolean(),
      overall_average: z.number(),
      ready_to_publish: z.boolean(),
      iterations_required: z.number(),
    }),
  }),
  seo_metadata: z.object({
    meta_title: z.string(),
    meta_description: z.string(),
    og_title: z.string(),
    og_description: z.string(),
    og_image_url: z.string(),
    og_type: z.string(),
    twitter_card: z.string(),
    twitter_title: z.string(),
    twitter_description: z.string(),
    twitter_image_url: z.string(),
    canonical_url: z.string(),
    schema_json_ld: z.record(z.string(), z.unknown()),
  }),
  eeat_analysis: z.object({
    experience_signals: z.array(z.string()),
    expertise_signals: z.array(z.string()),
    authoritativeness_signals: z.array(z.string()),
    trustworthiness_signals: z.array(z.string()),
  }),
  seo_analysis: z.object({
    primary_keyword: z.string(),
    lsi_keywords: z.array(z.string()),
    technical_factors: z.array(z.string()),
    semantic_factors: z.array(z.string()),
    machine_readability: z.array(z.string()),
  }),
  optimization_suggestions: z.array(z.string()),
  research_sources: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
      score: z.number(),
    }),
  ),
  quality_warning: z.boolean(),
  quality_warning_message: z.string().nullable(),
  metadata: z.object({
    ai_model: z.string(),
    iterations_required: z.number(),
    tavily_searches_performed: z.number(),
    ai_generated_at: z.string(),
  }),
});

export class GenerateSocialPostResponse extends createZodDto(
  GenerateSocialPostResponseSchema,
) {}

type ScoreDto = z.infer<typeof scoreSchema>;
type VariationDto = z.infer<typeof variationSchema>;

function toScore(score: QualityScore, threshold: number): ScoreDto {
  return {
    value: score.value,
    threshold,
    passes: score.value >= threshold,
    factors: score.factors,
    explanation: score.explanation,
  };
}

function toVariation(v: PlatformVariation | undefined): VariationDto {
  return {
    adapted_content: v?.adaptedContent ?? '',
    character_count: v?.characterCount ?? null,
    word_count: v?.wordCount ?? null,
    hashtags: v?.hashtags ?? [],
    image_prompt: v?.imagePrompt ?? '',
    cover_image_url: v?.coverImageUrl ?? null,
    subject_line: v?.subjectLine ?? null,
    preview_text: v?.previewText ?? null,
    is_thread: v?.isThread ?? false,
    thread_tweets: v?.threadTweets ?? [],
  };
}

function variation(pkg: SocialPostPackage, platform: string) {
  return pkg.platformVariations.find((v) => v.platform === platform);
}

export function toSocialPostResponse(
  result: SocialGenerationResult,
): GenerateSocialPostResponse {
  const pkg = result.pkg;
  const evaluation = evaluateScores(pkg.scores);
  const humanWriting = toScore(
    pkg.scores.humanWritingIndex,
    SCORE_THRESHOLDS.humanWritingIndex,
  );

  return {
    id: result.id,
    post_content: {
      headline: pkg.postContent.headline,
      body: pkg.postContent.body,
      call_to_action: pkg.postContent.callToAction,
      hashtags: pkg.postContent.hashtags,
    },
    platform_variations: {
      blog: toVariation(variation(pkg, 'blog')),
      linkedin: toVariation(variation(pkg, 'linkedin')),
      twitter: toVariation(variation(pkg, 'twitter')),
      newsletter: toVariation(variation(pkg, 'newsletter')),
      facebook: toVariation(variation(pkg, 'facebook')),
    },
    cover_image: {
      main_prompt: pkg.coverImage.mainPrompt,
      main_image_url: pkg.coverImage.mainImageUrl,
      style: pkg.coverImage.style,
      color_palette: pkg.coverImage.colorPalette,
      mood: pkg.coverImage.mood,
      key_elements: pkg.coverImage.keyElements,
    },
    scores: {
      human_writing_index: humanWriting,
      human_likeness_score: humanWriting,
      eeat_score: toScore(pkg.scores.eeatScore, SCORE_THRESHOLDS.eeatScore),
      virality_score: toScore(
        pkg.scores.viralityScore,
        SCORE_THRESHOLDS.viralityScore,
      ),
      roi_score: toScore(pkg.scores.roiScore, SCORE_THRESHOLDS.roiScore),
      seo_score: toScore(pkg.scores.seoScore, SCORE_THRESHOLDS.seoScore),
      ai_detection_risk: {
        value: pkg.aiDetectionRisk.value,
        label: pkg.aiDetectionRisk.label,
        explanation: pkg.aiDetectionRisk.explanation,
      },
      summary: {
        all_pass: evaluation.allPass,
        overall_average: evaluation.overallAverage,
        ready_to_publish: evaluation.allPass,
        iterations_required: pkg.metadata.iterationsRequired,
      },
    },
    seo_metadata: {
      meta_title: pkg.seoMetadata.metaTitle,
      meta_description: pkg.seoMetadata.metaDescription,
      og_title: pkg.seoMetadata.ogTitle,
      og_description: pkg.seoMetadata.ogDescription,
      og_image_url: pkg.seoMetadata.ogImageUrl,
      og_type: pkg.seoMetadata.ogType,
      twitter_card: pkg.seoMetadata.twitterCard,
      twitter_title: pkg.seoMetadata.twitterTitle,
      twitter_description: pkg.seoMetadata.twitterDescription,
      twitter_image_url: pkg.seoMetadata.twitterImageUrl,
      canonical_url: pkg.seoMetadata.canonicalUrl,
      schema_json_ld: pkg.seoMetadata.schemaJsonLd,
    },
    eeat_analysis: {
      experience_signals: pkg.eeatAnalysis.experienceSignals,
      expertise_signals: pkg.eeatAnalysis.expertiseSignals,
      authoritativeness_signals: pkg.eeatAnalysis.authoritativenessSignals,
      trustworthiness_signals: pkg.eeatAnalysis.trustworthinessSignals,
    },
    seo_analysis: {
      primary_keyword: pkg.seoAnalysis.primaryKeyword,
      lsi_keywords: pkg.seoAnalysis.lsiKeywords,
      technical_factors: pkg.seoAnalysis.technicalFactors,
      semantic_factors: pkg.seoAnalysis.semanticFactors,
      machine_readability: pkg.seoAnalysis.machineReadability,
    },
    optimization_suggestions: pkg.optimizationSuggestions,
    research_sources: pkg.researchSources.map((s) => ({
      title: s.title,
      url: s.url,
      snippet: s.snippet,
      score: s.score,
    })),
    quality_warning: pkg.metadata.qualityWarning,
    quality_warning_message: pkg.metadata.qualityWarningMessage,
    metadata: {
      ai_model: pkg.metadata.aiModel,
      iterations_required: pkg.metadata.iterationsRequired,
      tavily_searches_performed: pkg.metadata.tavilySearchesPerformed,
      ai_generated_at: pkg.metadata.aiGeneratedAt,
    },
  };
}
