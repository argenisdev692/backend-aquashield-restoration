import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../../../../shared/storage/storage.service';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { type IPolicy } from 'cockatiel';
import { createExternalServicePolicy } from '../../../../../shared/external/resilience';
import type { AiPostGenerationPort } from '../../../domain/ports/ai-post-generation.port';
import { RESEARCH_PORT } from '../../../domain/ports/research.port';
import type { ResearchPort } from '../../../domain/ports/research.port';
import { GeneratedPostPreview } from '../../../domain/value-objects/generated-post-preview.vo';
import { ResearchResult } from '../../../domain/value-objects/research-result.vo';
import {
  AI_CLIENT,
  type IAiClient,
} from '../../../../../shared/external/ai/ai-client.port';

@Injectable()
export class GeminiPostGenerationAdapter
  implements AiPostGenerationPort, OnModuleInit
{
  private readonly textModel: string;
  private readonly imageModel: string;
  private readonly imageDirectory = 'ai/posts';
  private resilience!: IPolicy;

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    @Inject(RESEARCH_PORT)
    private readonly research: ResearchPort,
    @Inject(AI_CLIENT)
    private readonly aiClient: IAiClient,
  ) {
    this.logger.setContext(GeminiPostGenerationAdapter.name);
    this.textModel = this.config.get<string>(
      'GEMINI_TEXT_MODEL',
      'gemini-2.5-flash',
    );
    this.imageModel = this.config.get<string>(
      'GEMINI_IMAGE_MODEL',
      'gemini-2.0-flash-exp-image-generation',
    );
  }

  onModuleInit(): void {
    this.resilience = createExternalServicePolicy('gemini', 'ai');
  }

  async generatePreview(
    topic: string,
    niche: string,
    wordCount: number,
  ): Promise<GeneratedPostPreview> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GeminiPostGenerationAdapter.generatePreview start', {
      traceId,
      topic,
      niche,
      wordCount,
    });

    const research = await this.research.research(`${topic} ${niche}`);
    this.logger.info('GeminiPostGenerationAdapter research done', {
      traceId,
      sources: research.sources.length,
    });

    const rawContent = await this.generateArticleWithGemini(
      topic,
      niche,
      wordCount,
      research,
    );
    const content = this.humanize(rawContent);
    this.logger.info('GeminiPostGenerationAdapter article generated', {
      traceId,
    });

    const seo = await this.generateSeoFields(topic, niche, content);
    this.logger.info('GeminiPostGenerationAdapter seo fields generated', {
      traceId,
    });

    const imageUrl = await this.generateAndUploadHeroImage(topic, niche);
    if (!imageUrl) {
      this.logger.warn(
        'GeminiPostGenerationAdapter hero image generation failed or skipped',
        { traceId },
      );
    }

    return new GeneratedPostPreview(
      content,
      seo.postTitleSlug,
      seo.postExcerpt,
      seo.metaTitle,
      seo.metaDescription,
      seo.metaKeywords,
      imageUrl,
      research.sources,
    );
  }

  private async generateArticleWithGemini(
    topic: string,
    niche: string,
    wordCount: number,
    research: ResearchResult,
  ): Promise<string> {
    const sourcesContext = research.sources
      .slice(0, 5)
      .map(
        (s, i) => `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}`,
      )
      .join('\n\n---\n\n');

    const system = `You are an expert content writer for the ${niche} industry. Your goal is to create articles that pass Google's E-E-A-T standards.

WRITING RULES (critical):
1. Vary sentence length: mix short punchy sentences with developed paragraphs.
2. Use concrete, specific language — never abstract or generic.
3. Include at least one practical example or real case from the sector.
4. Use first person when natural ("in my experience", "I've seen that").
5. Express a nuanced personal opinion — don't be 100% neutral.
6. AVOID these AI giveaway words: "robust", "comprehensive", "it's worth noting", "in conclusion", "in summary", "undoubtedly", "fundamentally".
7. Don't start consecutive paragraphs with the same structure.
8. Include rhetorical questions or conversational transition phrases.
9. Cite real sources organically within the text, not as a list at the end.
10. Tone: professional but approachable.

SEO STRUCTURE (natural):
- H1: title with main keyword (compelling, not clickbait)
- Intro: hook in the first 2 sentences, present the problem
- H2/H3: logical structure that answers search intent
- Closing: actionable, not a simple "summary of what we've seen"

Respond ONLY with the article in Markdown. No preamble or explanations.`;

    const user = `Write an article of ~${wordCount} words about: **${topic}**

RESEARCH CONTEXT (use as factual base):

Research summary: ${research.summary}

Reference sources:
${sourcesContext}

Use these real data points to give depth to the article. Cite sources organically.`;

    const response = await this.resilience.execute(async () => {
      return await this.aiClient.complete({
        model: this.textModel,
        messages: [{ role: 'user', content: user }],
        systemInstruction: system,
        maxTokens: 8192,
        temperature: 0.7,
      });
    });

    const text = response.text ?? '';
    this.logUsage('article', this.textModel, response.usage);

    if (!text) {
      throw new Error('Gemini returned empty content for article generation');
    }
    return text;
  }

  private async generateSeoFields(
    topic: string,
    niche: string,
    content: string,
  ): Promise<{
    postTitleSlug: string;
    postExcerpt: string;
    metaTitle: string;
    metaDescription: string;
    metaKeywords: string;
  }> {
    const excerpt = content.replace(/<[^>]*>/g, '').substring(0, 300);

    const system =
      'You are an SEO expert. You respond ONLY with a valid JSON object, no markdown fences, no commentary.';

    const user = `Based on this article about "${topic}" in the "${niche}" niche, generate the following SEO fields.

Article preview (first 300 chars):
${excerpt}

Return ONLY a JSON object with exactly these keys:
{
  "post_title_slug": "kebab-case-slug-max-60-chars",
  "post_excerpt": "Compelling 1-2 sentence summary, 120-160 chars, no AI clichés",
  "meta_title": "SEO title under 60 chars including main keyword",
  "meta_description": "Meta description 140-160 chars, includes keyword, compelling CTA",
  "meta_keywords": "keyword1, keyword2, keyword3, keyword4, keyword5"
}`;

    const response = await this.resilience.execute(async () => {
      return await this.aiClient.complete({
        model: this.textModel,
        messages: [{ role: 'user', content: user }],
        systemInstruction: system,
        maxTokens: 1024,
        temperature: 0.3,
        responseMimeType: 'application/json',
      });
    });

    const raw = response.text ?? '';
    this.logUsage('seo', this.textModel, response.usage);

    let decoded: Record<string, unknown> | null = null;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        decoded = parsed as Record<string, unknown>;
      }
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            decoded = parsed as Record<string, unknown>;
          }
        } catch {
          // ignore secondary parse failure
        }
      }
    }

    const slug = topic.toLowerCase().replace(/\s+/g, '-').substring(0, 60);

    const getString = (val: unknown, fallback: string): string =>
      typeof val === 'string' && val.length > 0 ? val : fallback;

    return {
      postTitleSlug: getString(decoded?.post_title_slug, slug),
      postExcerpt: getString(decoded?.post_excerpt, excerpt.substring(0, 160)),
      metaTitle: getString(decoded?.meta_title, topic),
      metaDescription: getString(decoded?.meta_description, ''),
      metaKeywords: getString(decoded?.meta_keywords, ''),
    };
  }

  private async generateAndUploadHeroImage(
    topic: string,
    niche: string,
  ): Promise<string | null> {
    const traceId = this.cls.get<string>('traceId');

    try {
      const prompt = `Create a professional, high-quality hero image for a blog article about "${topic}" in the ${niche} industry. Photorealistic style, clean composition, suitable for a modern blog header. No text, no logos.`;

      if (!this.aiClient.generateImage) {
        this.logger.warn(
          'Current AI client does not support image generation',
          { traceId },
        );
        return null;
      }

      const imageResult = await this.resilience.execute(async () => {
        return await this.aiClient.generateImage!({
          model: this.imageModel,
          prompt,
        });
      });

      this.logUsage('image', this.imageModel, undefined);

      const buffer = Buffer.from(imageResult.base64, 'base64');
      const key = `${this.imageDirectory}/${Date.now()}-${this.slugify(topic)}.${this.extensionFromMime(imageResult.mimeType)}`;

      await this.storage.upload(key, buffer, imageResult.mimeType);
      const url = this.storage.publicUrl(key);

      this.logger.info('GeminiPostGenerationAdapter hero image uploaded', {
        traceId,
        key,
      });
      return url;
    } catch (error) {
      this.logger.error(
        'GeminiPostGenerationAdapter hero image generation/upload failed',
        {
          traceId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return null;
    }
  }

  private humanize(content: string): string {
    const replacements: Record<string, string> = {
      "\\bit's worth noting that\\b": 'importantly,',
      '\\bin conclusion\\b': 'to close,',
      '\\bin summary\\b': 'to sum up,',
      '\\bundoubtedly\\b': 'clearly,',
      '\\bfundamentally\\b': 'essentially,',
      '\\bin this sense\\b': '',
      '\\bin the realm of\\b': 'in',
      '\\brobustness\\b': 'reliability',
      '\\brobust\\b': 'solid',
      '\\bcomprehensive\\b': 'complete',
      '\\bparadigm\\b': 'approach',
      '\\boptimize\\b': 'improve',
      '\\bleverage\\b': 'use',
      '\\bempower\\b': 'enable',
      '\\bseamless(ly)?\\b': 'smooth',
      '\\bdelve\\b': 'explore',
    };

    let result = content;
    for (const [pattern, replacement] of Object.entries(replacements)) {
      const regex = new RegExp(pattern, 'gi');
      result = result.replace(regex, replacement);
    }
    return result.trim();
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 60);
  }

  private extensionFromMime(mime: string): string {
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('gif')) return 'gif';
    return 'png';
  }

  private logUsage(
    step: string,
    model: string,
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    },
  ): void {
    const traceId = this.cls.get<string>('traceId');
    const prompt = usage?.promptTokens ?? 0;
    const candidates = usage?.completionTokens ?? 0;
    const total = usage?.totalTokens ?? prompt + candidates;

    const pricePer1k = this.getApproxPricePer1kTokens(model);
    const estCostUsd = ((total / 1000) * pricePer1k).toFixed(6);

    this.logger.info('Gemini usage', {
      traceId,
      step,
      model,
      promptTokens: prompt,
      candidateTokens: candidates,
      totalTokens: total,
      estCostUsd,
    });
  }

  private getApproxPricePer1kTokens(model: string): number {
    if (model.includes('gemini-2.5')) return 0.00035;
    if (model.includes('gemini-2.0') && model.includes('image')) return 0.0005;
    if (model.includes('gemini-2.0')) return 0.0001;
    return 0.0005;
  }
}
