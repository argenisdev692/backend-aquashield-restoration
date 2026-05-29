import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { type IPolicy } from 'cockatiel';
import { createExternalServicePolicy } from '../../../../../shared/external/resilience';
import { LoggerService } from '../../../../../logger/logger.service';
import {
  AI_CLIENT,
  type IAiClient,
} from '../../../../../shared/external/ai/ai-client.port';
import type {
  SocialPostGenerationPort,
  SocialIdeasInput,
  GeneratePackageParams,
} from '../../../domain/ports/social-post-generation.port';
import {
  SocialIdeaSet,
  type NicheAnalysis,
  type SocialContentIdea,
} from '../../../domain/value-objects/social-content-idea.vo';
import {
  SocialPostPackage,
  type PlatformVariation,
  type SeoMetadata,
} from '../../../domain/value-objects/social-post-package.vo';
import type {
  SocialPostScores,
  QualityScore,
  ScoreWeakness,
} from '../../../domain/value-objects/social-post-scores.vo';
import type { ResearchResult } from '../../../domain/value-objects/research-result.vo';

type Json = Record<string, unknown>;

const SOCIAL_PLATFORMS = [
  'blog',
  'linkedin',
  'twitter',
  'newsletter',
  'facebook',
] as const;

const STEP1_SYSTEM = `You are a Senior Social Media Content Strategist with 10+ years of experience in viral content creation, SEO and audience engagement across Blog, LinkedIn, Twitter/X, Newsletter and Facebook.

INSTRUCTIONS:
1. Use the provided Tavily research to identify current trends and high-performing topics. If none, reason from your knowledge of the niche.
2. Analyze the niche: target audience, pain points, content preferences.
3. Generate EXACTLY 10 distinct, immediately-actionable content ideas balancing virality, ROI and EEAT.
4. Avoid generic, over-saturated topics. Prioritize timely, specific, data-backed angles. Include at least 3 ideas with estimated_virality >= 80.

Return ONLY a valid JSON object, no markdown fences, no preamble:
{"niche_analysis":{"target_audience":"","audience_demographics":"","key_pain_points":[""],"content_preferences":[""],"trending_topics":[""],"tavily_insights":[""]},"content_ideas":[{"id":1,"title":"","angle":"","hook":"","platform":"blog|linkedin|twitter|newsletter|facebook|multi","estimated_virality":0,"estimated_roi":0,"estimated_engagement":"high|medium|low","difficulty":"easy|medium|hard","eeat_potential":0,"why_it_works":"","key_trend":"","suggested_format":"post|thread|carousel|article|email|story","content_type":"educational|entertainment|inspirational|promotional|news"}]}`;

const STEP2_SYSTEM = `You are an elite Social Media Content Strategist and SEO specialist obsessed with content that reads as 100% human-written AND drives measurable business results.

Generate a complete content package that scores HIGH on all 5 metrics:
- Human Writing Index >= 75 (CRITICAL)
- EEAT Score >= 70, Virality Score >= 70, ROI Score >= 70, SEO Score >= 70

MANDATORY human-writing rules: never use AI clichés ("in conclusion","it's important to note","in today's fast-paced world","at the end of the day"). Vary sentence length aggressively. Include a specific anecdote/failure/number, natural hedging ("in my experience"), and concrete data ("73% of B2B companies", "in Q1 2026").
EEAT: include a specific experience, 3+ domain terms, 2+ authoritative sources from the research, and one honest caveat.
Virality: a shocking hook, shareability, emotional trigger, a trend from the last 90 days.
ROI: a specific CTA aligned with the goal, brand positioning, a lead-gen invitation.
SEO: primary keyword in headline + first 100 words + 2 subheadings (blog/newsletter), 3-5 LSI keywords, valid Schema.org JSON-LD, Open Graph + Twitter Card metadata.

If iteration feedback with failing scores is provided, change the angle/hook/evidence to specifically fix those scores — do not repeat the same content.

Platform specs: Blog 800-1500 words; LinkedIn 1000-1300 chars; Twitter <=280 chars or thread [1/N]; Newsletter 300-600 words + subject_line + preview_text (no hashtags); Facebook 400-600 chars. Each platform needs its own adapted_content, hashtags and a detailed Gemini Imagen image_prompt.

Return ONLY a valid JSON object, no markdown fences, no preamble:
{"post_content":{"headline":"","body":"","call_to_action":"","hashtags":[""]},"platform_variations":{"blog":{"adapted_content":"","word_count":0,"meta_title":"","meta_description":"","hashtags":[""],"image_prompt":""},"linkedin":{"adapted_content":"","character_count":0,"hashtags":[""],"image_prompt":""},"twitter":{"adapted_content":"","character_count":0,"is_thread":false,"thread_tweets":[],"hashtags":[""],"image_prompt":""},"newsletter":{"subject_line":"","preview_text":"","adapted_content":"","word_count":0,"image_prompt":""},"facebook":{"adapted_content":"","character_count":0,"hashtags":[""],"image_prompt":""}},"cover_image":{"main_prompt":"","style":"professional","color_palette":["#hex"],"mood":"professional","key_elements":[""]},"scores":{"human_writing_index":{"value":0,"factors":[""],"explanation":""},"eeat_score":{"value":0,"factors":[""],"explanation":""},"virality_score":{"value":0,"factors":[""],"explanation":""},"roi_score":{"value":0,"factors":[""],"explanation":""},"seo_score":{"value":0,"factors":[""],"explanation":""}},"seo_metadata":{"meta_title":"","meta_description":"","og_title":"","og_description":"","og_image_url":"","og_type":"article","twitter_card":"summary_large_image","twitter_title":"","twitter_description":"","twitter_image_url":"","canonical_url":"{{CANONICAL_URL}}","schema_json_ld":{"@context":"https://schema.org","@type":"BlogPosting"}},"eeat_analysis":{"experience_signals":[""],"expertise_signals":[""],"authoritativeness_signals":[""],"trustworthiness_signals":[""]},"seo_analysis":{"primary_keyword":"","lsi_keywords":[""],"technical_factors":[""],"semantic_factors":[""],"machine_readability":[""]},"optimization_suggestions":[""],"research_sources":[{"source":"","relevance":"high|medium|low","key_insight":"","used_in":["blog"]}],"ai_detection_risk":{"value":0,"label":"low","explanation":""}}`;

@Injectable()
export class GeminiSocialPostGenerationAdapter
  implements SocialPostGenerationPort, OnModuleInit
{
  private readonly textModel: string;
  private resilience!: IPolicy;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    @Inject(AI_CLIENT)
    private readonly aiClient: IAiClient,
  ) {
    this.logger.setContext(GeminiSocialPostGenerationAdapter.name);
    this.textModel = this.config.get<string>(
      'GEMINI_TEXT_MODEL',
      'gemini-2.5-flash',
    );
  }

  onModuleInit(): void {
    this.resilience = createExternalServicePolicy('gemini', 'ai');
  }

  async generateIdeas(
    input: SocialIdeasInput,
    research: ResearchResult,
  ): Promise<SocialIdeaSet> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GeminiSocialPostGenerationAdapter.generateIdeas start', {
      traceId,
      niche: input.niche,
    });

    const user = `Generate 10 viral content ideas for my niche: ${input.niche}

Target Audience: ${input.audience || 'infer from niche'}
Primary Platforms: ${input.platforms.join(', ')}
Business Goal: ${input.goal || 'awareness'}
Brand Voice: ${input.voice || 'professional'}
Company/Brand: ${input.company || 'not specified'}

Tavily Research Context:
${this.researchContext(research)}

Requirements: exactly 10 unique ideas with virality + ROI + EEAT estimates; leverage the research trends; at least 3 ideas with estimated_virality >= 80.`;

    const json = await this.completeJson(STEP1_SYSTEM, user, 8192, 0.8);

    const analysisRaw = asObject(json.niche_analysis);
    const nicheAnalysis: NicheAnalysis = {
      targetAudience: getString(
        analysisRaw.target_audience,
        input.audience ?? '',
      ),
      audienceDemographics: getString(analysisRaw.audience_demographics, ''),
      keyPainPoints: getStringArray(analysisRaw.key_pain_points),
      contentPreferences: getStringArray(analysisRaw.content_preferences),
      trendingTopics: getStringArray(analysisRaw.trending_topics),
      tavilyInsights: getStringArray(analysisRaw.tavily_insights),
    };

    const ideasRaw = Array.isArray(json.content_ideas)
      ? json.content_ideas
      : [];
    const ideas: SocialContentIdea[] = ideasRaw
      .map((raw, index) => this.mapIdea(asObject(raw), index, input.platforms))
      .slice(0, 10);

    this.logger.info('GeminiSocialPostGenerationAdapter.generateIdeas done', {
      traceId,
      ideas: ideas.length,
    });

    return new SocialIdeaSet(nicheAnalysis, ideas);
  }

  async generatePackage(
    params: GeneratePackageParams,
  ): Promise<SocialPostPackage> {
    const { idea, context, research, iteration, previousScores, weaknesses } =
      params;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GeminiSocialPostGenerationAdapter.generatePackage', {
      traceId,
      iteration,
      title: idea.title,
    });

    const user = `Generate a complete social media content package for all 5 platforms with high-quality scores.

SELECTED IDEA
Title: ${idea.title}
Angle: ${idea.angle}
Hook: ${idea.hook}
Suggested Format: ${idea.format}
Key Trend: ${idea.keyTrend}

CONTEXT
Niche: ${context.niche}
Target Audience: ${context.audience || 'infer from niche'}
Business Goal: ${context.goal || 'awareness'}
Brand Voice: ${context.voice || 'professional'}
Company/Organization: ${context.company || 'not specified'}

TAVILY RESEARCH (Iteration ${iteration})
${this.researchContext(research)}

ITERATION FEEDBACK
Current Iteration: ${iteration} of 5
${this.iterationFeedback(iteration, previousScores, weaknesses)}

REQUIREMENTS: all 5 scores MUST exceed thresholds. Human Writing Index is CRITICAL (>=75). Use specific data points from the research. Each platform must have its own adapted content, hashtags and a detailed image prompt. Newsletter must include subject_line and preview_text. Twitter/X: split into a thread with is_thread=true when over 280 chars.`;

    const json = await this.completeJson(STEP2_SYSTEM, user, 8192, 0.7);
    return this.mapPackage(json, research);
  }

  // ── Prompt helpers ──────────────────────────────────────────────────────

  private researchContext(research: ResearchResult): string {
    if (!research.sources.length && !research.summary) {
      return 'No external research available — reason from domain knowledge.';
    }
    const sources = research.sources
      .slice(0, 5)
      .map((s, i) => `[${i + 1}] ${s.title} (${s.url}): ${s.snippet}`)
      .join('\n');
    return `Summary: ${research.summary}\nSources:\n${sources}`;
  }

  private iterationFeedback(
    iteration: number,
    previousScores: SocialPostScores | null,
    weaknesses: ScoreWeakness[],
  ): string {
    if (iteration === 1 || !previousScores) {
      return 'This is the first attempt. Generate the best possible content from the start. Target: ALL scores >= their thresholds.';
    }
    const lines = weaknesses
      .map(
        (w) =>
          `- ${w.score}: was ${w.current}, needs ${w.target}+ (gap ${w.gap}). Why it failed: ${w.explanation}`,
      )
      .join('\n');
    return `Previous attempt failed these scores — fix them specifically without repeating the same content:\n${lines}`;
  }

  // ── Mapping ─────────────────────────────────────────────────────────────

  private mapIdea(
    raw: Json,
    index: number,
    platforms: string[],
  ): SocialContentIdea {
    return {
      id: getNumber(raw.id, index + 1),
      title: getString(raw.title, ''),
      angle: getString(raw.angle, ''),
      hook: getString(raw.hook, ''),
      platform: getString(raw.platform, platforms[0] ?? 'multi'),
      estimatedVirality: clampScore(getNumber(raw.estimated_virality, 0)),
      estimatedRoi: clampScore(getNumber(raw.estimated_roi, 0)),
      estimatedEngagement: getString(raw.estimated_engagement, 'medium'),
      difficulty: getString(raw.difficulty, 'medium'),
      eeatPotential: clampScore(getNumber(raw.eeat_potential, 0)),
      whyItWorks: getString(raw.why_it_works, ''),
      keyTrend: getString(raw.key_trend, ''),
      suggestedFormat: getString(raw.suggested_format, 'post'),
      contentType: getString(raw.content_type, 'educational'),
    };
  }

  private mapPackage(json: Json, research: ResearchResult): SocialPostPackage {
    const pcRaw = asObject(json.post_content);
    const variationsRaw = asObject(json.platform_variations);
    const coverRaw = asObject(json.cover_image);
    const seoRaw = asObject(json.seo_metadata);
    const eeatRaw = asObject(json.eeat_analysis);
    const seoAnalysisRaw = asObject(json.seo_analysis);
    const riskRaw = asObject(json.ai_detection_risk);

    const variations: PlatformVariation[] = SOCIAL_PLATFORMS.map((platform) =>
      this.mapVariation(platform, asObject(variationsRaw[platform])),
    );

    const seoMetadata: SeoMetadata = {
      metaTitle: getString(seoRaw.meta_title, ''),
      metaDescription: getString(seoRaw.meta_description, ''),
      ogTitle: getString(seoRaw.og_title, ''),
      ogDescription: getString(seoRaw.og_description, ''),
      ogImageUrl: getString(seoRaw.og_image_url, ''),
      ogType: getString(seoRaw.og_type, 'article'),
      twitterCard: getString(seoRaw.twitter_card, 'summary_large_image'),
      twitterTitle: getString(seoRaw.twitter_title, ''),
      twitterDescription: getString(seoRaw.twitter_description, ''),
      twitterImageUrl: getString(seoRaw.twitter_image_url, ''),
      canonicalUrl: getString(seoRaw.canonical_url, '{{CANONICAL_URL}}'),
      schemaJsonLd: asObject(seoRaw.schema_json_ld),
    };

    return new SocialPostPackage(
      {
        headline: getString(pcRaw.headline, ''),
        body: getString(pcRaw.body, ''),
        callToAction: getString(pcRaw.call_to_action, ''),
        hashtags: getStringArray(pcRaw.hashtags),
      },
      variations,
      {
        mainPrompt: getString(coverRaw.main_prompt, ''),
        style: getString(coverRaw.style, 'professional'),
        colorPalette: getStringArray(coverRaw.color_palette),
        mood: getString(coverRaw.mood, 'professional'),
        keyElements: getStringArray(coverRaw.key_elements),
        mainImageUrl: null,
      },
      this.mapScores(asObject(json.scores)),
      seoMetadata,
      {
        experienceSignals: getStringArray(eeatRaw.experience_signals),
        expertiseSignals: getStringArray(eeatRaw.expertise_signals),
        authoritativenessSignals: getStringArray(
          eeatRaw.authoritativeness_signals,
        ),
        trustworthinessSignals: getStringArray(eeatRaw.trustworthiness_signals),
      },
      {
        primaryKeyword: getString(seoAnalysisRaw.primary_keyword, ''),
        lsiKeywords: getStringArray(seoAnalysisRaw.lsi_keywords),
        technicalFactors: getStringArray(seoAnalysisRaw.technical_factors),
        semanticFactors: getStringArray(seoAnalysisRaw.semantic_factors),
        machineReadability: getStringArray(seoAnalysisRaw.machine_readability),
      },
      getStringArray(json.optimization_suggestions),
      research.sources,
      {
        value: clampScore(getNumber(riskRaw.value, 0)),
        label: getString(riskRaw.label, 'low'),
        explanation: getString(riskRaw.explanation, ''),
      },
      {
        iterationsRequired: 1,
        qualityWarning: false,
        qualityWarningMessage: null,
        aiModel: this.textModel,
        tavilySearchesPerformed: 0,
        aiGeneratedAt: new Date().toISOString(),
      },
    );
  }

  private mapVariation(platform: string, raw: Json): PlatformVariation {
    const content = this.humanize(getString(raw.adapted_content, ''));
    const charCount = raw.character_count;
    const wordCount = raw.word_count;
    return {
      platform,
      adaptedContent: content,
      characterCount: typeof charCount === 'number' ? charCount : null,
      wordCount: typeof wordCount === 'number' ? wordCount : null,
      hashtags: getStringArray(raw.hashtags),
      imagePrompt: getString(raw.image_prompt, ''),
      coverImageUrl: null,
      subjectLine:
        platform === 'newsletter' ? getString(raw.subject_line, '') : null,
      previewText:
        platform === 'newsletter' ? getString(raw.preview_text, '') : null,
      isThread: platform === 'twitter' ? getBoolean(raw.is_thread) : false,
      threadTweets:
        platform === 'twitter' ? getStringArray(raw.thread_tweets) : [],
    };
  }

  private mapScores(raw: Json): SocialPostScores {
    return {
      humanWritingIndex: this.mapScore(raw.human_writing_index),
      eeatScore: this.mapScore(raw.eeat_score),
      viralityScore: this.mapScore(raw.virality_score),
      roiScore: this.mapScore(raw.roi_score),
      seoScore: this.mapScore(raw.seo_score),
    };
  }

  private mapScore(raw: unknown): QualityScore {
    const obj = asObject(raw);
    return {
      value: clampScore(getNumber(obj.value, 0)),
      explanation: getString(obj.explanation, ''),
      factors: normalizeFactors(obj.factors),
    };
  }

  // ── AI call + JSON extraction ─────────────────────────────────────────────

  private async completeJson(
    systemInstruction: string,
    user: string,
    maxTokens: number,
    temperature: number,
  ): Promise<Json> {
    const response = await this.resilience.execute(() =>
      this.aiClient.complete({
        model: this.textModel,
        messages: [{ role: 'user', content: user }],
        systemInstruction,
        maxTokens,
        temperature,
        responseMimeType: 'application/json',
      }),
    );

    const text = response.text ?? '';
    if (!text) {
      throw new Error('AI returned empty content for social generation');
    }
    return parseJsonObject(text);
  }

  private humanize(content: string): string {
    const replacements: Record<string, string> = {
      "\\bit's worth noting that\\b": 'importantly,',
      '\\bin conclusion\\b': 'to close,',
      '\\bin summary\\b': 'to sum up,',
      '\\bat the end of the day\\b': 'ultimately,',
      '\\bneedless to say\\b': 'clearly,',
      '\\bin today’s fast-paced world\\b': 'today',
      '\\bin todays fast-paced world\\b': 'today',
      '\\bleverage\\b': 'use',
      '\\bdelve\\b': 'explore',
    };
    let result = content;
    for (const [pattern, replacement] of Object.entries(replacements)) {
      result = result.replace(new RegExp(pattern, 'gi'), replacement);
    }
    return result.trim();
  }
}

// ── Pure parsing helpers ────────────────────────────────────────────────────

function parseJsonObject(raw: string): Record<string, unknown> {
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
    return null;
  };

  const direct = tryParse(raw);
  if (direct) return direct;

  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    const recovered = tryParse(match[0]);
    if (recovered) return recovered;
  }
  throw new Error('AI response was not valid JSON');
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function getNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function getBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) =>
      typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '',
    )
    .filter((v) => v.length > 0);
}

function normalizeFactors(value: unknown): string[] {
  if (Array.isArray(value)) return getStringArray(value);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `${k}: ${typeof v === 'number' ? v : String(v)}`,
    );
  }
  return [];
}

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}
