import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { type IPolicy } from 'cockatiel';
import { createExternalServicePolicy } from '../../../../shared/external/resilience';
import { LoggerService } from '../../../../logger/logger.service';
import {
  AI_CLIENT,
  type IAiClient,
} from '../../../../shared/external/ai/ai-client.port';
import {
  IStageExportGeneratorPort,
  GenerateStageExportInput,
  GeneratedStageContent,
  GeneratedScene,
} from '../../domain/ports/stage-export-generator.port';
import {
  buildScoreResult,
  type CampaignScores,
  type ScoreWeakness,
} from '../../domain/value-objects/campaign-scores.vo';

type Json = Record<string, unknown>;

const SYSTEM = `You are an elite Video Marketing Strategist creating viral, high-ROI short-form video campaigns (15-25 seconds) for TikTok, Instagram Reels, YouTube Shorts and Facebook. You are obsessed with scripts that read as 100% human-crafted and that drive measurable results in a specific geographic location.

Generate a complete video campaign package that scores HIGH on all 5 metrics:
- Local Market Fit >= 75 (CRITICAL)
- Virality Probability >= 70, ROI Potential >= 70, Audience Alignment >= 70, Trend Relevance >= 70

MANDATORY human-writing rules: never use AI clichés ("in conclusion","it's important to note","in today's fast-paced world","at the end of the day"). Vary sentence length aggressively. Use specific LOCAL data ("73% of businesses in [CITY]"), natural hedging ("in my experience in [CITY]"), and a local case study or counterintuitive local observation.
The script MUST include the user's AI_OBSERVATION phrase verbatim or naturally integrated, and stay within 15-25 seconds (38-63 words). Adapt tone to the funnel stage (TOFU educational/empathetic; MOFU professional/credible; BOFU urgent/direct; LOYALTY warm/community).
Break the video into exactly 4 scenes (0:00-0:05, 0:05-0:10, 0:10-0:15, 0:15-0:25), each with a visual description (English), image keywords, narration and optional overlay text.
If iteration feedback with failing scores is provided, change the angle/hook/evidence to fix those scores specifically — do not repeat the same content.

Return ONLY a valid JSON object, no markdown fences, no preamble:
{"video_content":{"headline":"","narration":"","overlay_texts":[""],"call_to_action":"","hashtags":[""]},"formats":{"vertical_916":{"adapted_narration":""},"horizontal_169":{"adapted_narration":""}},"scenes":[{"id":1,"timecode":"0:00-0:05","title":"","visual_description":"","image_keywords":[""],"duration_seconds":5,"narration":"","overlay_text":""}],"production_notes":{"specs_916":"1080x1920px · 60fps","specs_169":"1920x1080px · 30fps","music_tone":"","color_palette":["#hex"],"transition_style":""},"scores":{"local_market_fit":{"value":0,"explanation":""},"virality_probability":{"value":0,"explanation":""},"roi_potential":{"value":0,"explanation":""},"audience_alignment":{"value":0,"explanation":""},"trend_relevance":{"value":0,"explanation":""}}}`;

/**
 * Gemini-backed implementation of the Step-2 video generation prompt
 * (docs/AI-MODULES/CAMPAIGNS/prompt-campaigns-generator-v2.md). Produces the
 * scripts, scenes, production notes AND the 5 self-assessed quality scores that
 * the processor's quality loop evaluates. All AI calls go through the breaker.
 */
@Injectable()
export class GeminiStageExportGeneratorAdapter
  implements IStageExportGeneratorPort, OnModuleInit
{
  private readonly textModel: string;
  private resilience!: IPolicy;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
  ) {
    this.logger.setContext(GeminiStageExportGeneratorAdapter.name);
    this.textModel = this.config.get<string>(
      'GEMINI_TEXT_MODEL',
      'gemini-2.5-flash',
    );
  }

  onModuleInit(): void {
    this.resilience = createExternalServicePolicy('gemini', 'ai');
  }

  async generate(
    input: GenerateStageExportInput,
  ): Promise<GeneratedStageContent> {
    const traceId = this.cls.get<string>('traceId');
    const iteration = input.iteration ?? 1;

    this.logger.info('GeminiStageExportGeneratorAdapter.generate', {
      traceId,
      stage: input.stage,
      iteration,
    });

    const user = this.buildUserPrompt(input, iteration);
    const json = await this.completeJson(user);

    const vc = asObject(json.video_content);
    const formats = asObject(json.formats);
    const v916 = asObject(formats.vertical_916);
    const h169 = asObject(formats.horizontal_169);
    const baseNarration = getString(vc.narration, '');
    const overlay = getStringArray(vc.overlay_texts);
    const cta = getString(vc.call_to_action, '');

    const scenesRaw = Array.isArray(json.scenes) ? json.scenes : [];
    const scenes: GeneratedScene[] = scenesRaw
      .map((raw, i) => this.mapScene(asObject(raw), i))
      .slice(0, 4);

    const notes = asObject(json.production_notes);

    return {
      stage: input.stage,
      scripts: {
        vertical_916: {
          narration: getString(v916.adapted_narration, baseNarration),
          overlayTexts: overlay,
          cta,
        },
        horizontal_169: {
          narration: getString(h169.adapted_narration, baseNarration),
          overlayTexts: overlay,
          cta,
        },
      },
      scenes:
        scenes.length > 0 ? scenes : this.fallbackScenes(input.durationSeconds),
      productionNotes: {
        specs916: getString(notes.specs_916, '1080x1920px · 60fps'),
        specs169: getString(notes.specs_169, '1920x1080px · 30fps'),
        musicTone: getString(notes.music_tone, 'Uplifting corporate'),
        colorPalette: getStringArray(notes.color_palette),
        transitionStyle: getString(notes.transition_style, 'Smooth cross-dissolve'),
      },
      scores: this.mapScores(asObject(json.scores)),
    };
  }

  // ── Prompt building ──────────────────────────────────────────────────────

  private buildUserPrompt(
    input: GenerateStageExportInput,
    iteration: number,
  ): string {
    const geo = [input.city, input.state, input.country]
      .filter(Boolean)
      .join(', ');
    const research = input.viralityRecommendations?.length
      ? `\nResearch recommendations:\n- ${input.viralityRecommendations.join('\n- ')}`
      : '';

    return `Generate a complete 15-25s video campaign package with high-quality scores.

CONTEXT
Company: ${input.companyName}
Niche: ${input.niche}
Location: ${input.location}${geo ? `\nGeo: ${geo}` : ''}
Phone: ${input.phone}${input.website ? `\nWebsite: ${input.website}` : ''}
Funnel Stage: ${input.stage}
Video Format: ${input.format}
Duration: ${input.durationSeconds} seconds
Language: ${input.language}
${input.topicId ? `Selected Topic Id: ${input.topicId}` : ''}

AI OBSERVATION (MUST INCLUDE IN SCRIPT)
${input.aiObservations ?? '(none provided)'}
${research}

ITERATION FEEDBACK
Current Iteration: ${iteration} of 5
${this.iterationFeedback(iteration, input.weaknesses ?? [])}

REQUIREMENTS: 4 scenes with timecodes; narration 38-63 words; include the AI_OBSERVATION; all 5 scores must exceed thresholds; Local Market Fit is CRITICAL (>=75) with concrete local references and data.`;
  }

  private iterationFeedback(
    iteration: number,
    weaknesses: ScoreWeakness[],
  ): string {
    if (iteration === 1 || weaknesses.length === 0) {
      return 'First attempt — generate the best possible video. Target ALL scores >= thresholds.';
    }
    const lines = weaknesses
      .map(
        (w) =>
          `- ${w.score}: was ${w.current}, needs ${w.target}+ (gap ${w.gap}). Why it failed: ${w.explanation}`,
      )
      .join('\n');
    return `Previous attempt failed these scores — fix them specifically without repeating the same content:\n${lines}`;
  }

  // ── Mapping ──────────────────────────────────────────────────────────────

  private mapScene(raw: Json, index: number): GeneratedScene {
    const fallbackTimecodes = ['0:00-0:05', '0:05-0:10', '0:10-0:15', '0:15-0:25'];
    return {
      id: getNumber(raw.id, index + 1),
      timecode: getString(raw.timecode, fallbackTimecodes[index] ?? '0:00-0:05'),
      title: getString(raw.title, `Scene ${index + 1}`),
      visualDescription: getString(raw.visual_description, ''),
      imageKeywords: getStringArray(raw.image_keywords),
      durationSeconds: getNumber(raw.duration_seconds, index === 3 ? 10 : 5),
    };
  }

  private mapScores(raw: Json): CampaignScores {
    return {
      localMarketFit: this.mapScore('localMarketFit', raw.local_market_fit),
      viralityProbability: this.mapScore(
        'viralityProbability',
        raw.virality_probability,
      ),
      roiPotential: this.mapScore('roiPotential', raw.roi_potential),
      audienceAlignment: this.mapScore(
        'audienceAlignment',
        raw.audience_alignment,
      ),
      trendRelevance: this.mapScore('trendRelevance', raw.trend_relevance),
    };
  }

  private mapScore(
    key: keyof CampaignScores,
    raw: unknown,
  ): CampaignScores[keyof CampaignScores] {
    const obj = asObject(raw);
    return buildScoreResult(
      key,
      getNumber(obj.value, 0),
      getString(obj.explanation, ''),
    );
  }

  private fallbackScenes(duration: 15 | 20): GeneratedScene[] {
    const last = duration === 20 ? 10 : 5;
    return [
      { id: 1, timecode: '0:00-0:05', title: 'Hook', visualDescription: '', imageKeywords: [], durationSeconds: 5 },
      { id: 2, timecode: '0:05-0:10', title: 'Value', visualDescription: '', imageKeywords: [], durationSeconds: 5 },
      { id: 3, timecode: '0:10-0:15', title: 'AI Observation', visualDescription: '', imageKeywords: [], durationSeconds: 5 },
      { id: 4, timecode: `0:15-0:${15 + last}`, title: 'CTA', visualDescription: '', imageKeywords: [], durationSeconds: last },
    ];
  }

  // ── AI call + JSON extraction ──────────────────────────────────────────────

  private async completeJson(user: string): Promise<Json> {
    const response = await this.resilience.execute(() =>
      this.aiClient.complete({
        model: this.textModel,
        messages: [{ role: 'user', content: user }],
        systemInstruction: SYSTEM,
        maxTokens: 8192,
        temperature: 0.8,
        responseMimeType: 'application/json',
      }),
    );
    const text = response.text ?? '';
    if (!text) {
      throw new Error('AI returned empty content for campaign stage generation');
    }
    return parseJsonObject(text);
  }
}

// ── Pure parsing helpers ──────────────────────────────────────────────────────

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

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) =>
      typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '',
    )
    .filter((v) => v.length > 0);
}
