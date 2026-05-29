import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { type IPolicy } from 'cockatiel';
import { createExternalServicePolicy } from '../../../../shared/external/resilience';
import {
  AI_CLIENT,
  type IAiClient,
} from '../../../../shared/external/ai/ai-client.port';
import type {
  IPostGeneratorPort,
  GeneratePostsInput,
  GeneratedPostsMap,
  GeneratePostsWithFeedbackInput,
  GeneratedPostsWithScores,
  RegenerationFeedback,
  ScoreEvaluation,
} from '../../domain/ports/post-generator.port';
import type { SocialNetwork } from '../../domain/entities/social-media-generation.entity';

interface GeminiSocialPostSchema {
  facebook?: { body: string; hashtags: string[] };
  instagram?: { body: string; hashtags: string[]; emojis: string };
  tiktok?: { body: string; hashtags: string[]; hook: string };
  linkedin?: { body: string; hashtags: string[] };
  twitter?: { body: string; hashtags: string[] };
}

const SOCIAL_POST_JSON_SCHEMA = {
  type: 'object',
  properties: {
    facebook: {
      type: 'object',
      properties: {
        body: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['body', 'hashtags'],
    },
    instagram: {
      type: 'object',
      properties: {
        body: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
        emojis: { type: 'string' },
      },
      required: ['body', 'hashtags', 'emojis'],
    },
    tiktok: {
      type: 'object',
      properties: {
        body: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
        hook: { type: 'string' },
      },
      required: ['body', 'hashtags', 'hook'],
    },
    linkedin: {
      type: 'object',
      properties: {
        body: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['body', 'hashtags'],
    },
    twitter: {
      type: 'object',
      properties: {
        body: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['body', 'hashtags'],
    },
  },
  additionalProperties: false,
};

@Injectable()
export class GeminiPostGeneratorAdapter
  implements IPostGeneratorPort, OnModuleInit
{
  private readonly model: string;
  private resilience!: IPolicy;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
  ) {
    this.logger.setContext(GeminiPostGeneratorAdapter.name);
    this.model = this.config.get<string>(
      'GEMINI_TEXT_MODEL',
      'gemini-2.5-flash',
    );
  }

  onModuleInit(): void {
    this.resilience = createExternalServicePolicy('gemini', 'ai');
  }

  async generatePosts(input: GeneratePostsInput): Promise<GeneratedPostsMap> {
    const result = await this.generatePostsWithFeedback(input);
    const { scores, ai_detection_risk, ...posts } = result;
    return posts;
  }

  async generatePostsWithFeedback(
    input: GeneratePostsWithFeedbackInput,
  ): Promise<GeneratedPostsWithScores> {
    const traceId = this.cls.get<string>('traceId');
    const {
      topicTitle,
      topicDescription,
      activeNetworks,
      language = 'es',
      feedback,
    } = input;

    this.logger.info('GeminiPostGeneratorAdapter.generatePostsWithFeedback start', {
      traceId,
      networks: activeNetworks,
      iteration: feedback?.iteration ?? 1,
    });

    const networkList = activeNetworks.join(', ');
    let feedbackInstruction = '';
    if (feedback) {
      const weaknessList = feedback.weaknesses
        .map(
          (w) =>
            `- ${w.score}: actualmente ${w.current}/100, objetivo ${w.target}/100. ${w.explanation}`,
        )
        .join('\n');
      feedbackInstruction = `\n\nFEEDBACK DE ITERACIÓN ANTERIOR (iteración ${feedback.iteration}):\n${weaknessList}\n\nMejora específicamente estos aspectos en la nueva generación.`;
    }

    const systemInstruction = `Eres un experto copywriter de redes sociales en español (o el idioma indicado) especializado en contenido viral y de alta calidad humana.
Tu objetivo es generar posts que puntúen ALTO en: Human Writing Index (≥75), Virality (≥70), Engagement (≥70), ROI (≥70), Trend Alignment (≥70).${feedbackInstruction}

Responde EXCLUSIVAMENTE con JSON válido que cumpla exactamente este schema (sin markdown, sin explicaciones):

${JSON.stringify(SOCIAL_POST_JSON_SCHEMA, null, 2)}

Además, incluye al final del JSON un campo "scores" con la autoevaluación de tu generación:
{
  "scores": {
    "human_writing_index": 0-100,
    "virality_score": 0-100,
    "engagement_score": 0-100,
    "roi_score": 0-100,
    "trend_alignment": 0-100
  },
  "ai_detection_risk": 0-100
}

Reglas por plataforma:
- facebook: conversacional, 150-300 palabras, 5-8 hashtags.
- instagram: visual, con emojis, 80-150 palabras, 10-15 hashtags. El campo "emojis" debe ser un string con 3-6 emojis separados por espacio.
- tiktok: hook poderoso en la primera línea (campo "hook"), lenguaje joven, 50-80 palabras, 8-12 hashtags.
- linkedin: profesional, valor de negocio, 150-250 palabras, 3-5 hashtags.
- twitter: punchy y directo, máximo 280 caracteres en "body", 1-2 hashtags.

Solo incluye en el JSON las claves de las redes que el usuario pidió activar.
Si una red no está activa, NO la incluyas en la respuesta JSON.`;

    const userPrompt = `Nicho: ${topicTitle}
Descripción del tema: ${topicDescription}
Idioma objetivo: ${language}
Redes activas: ${networkList}

Genera los posts ahora con sus scores de calidad.`;

    const result = await this.resilience.execute(async () => {
      return await this.aiClient.complete({
        model: this.model,
        messages: [{ role: 'user', content: userPrompt }],
        systemInstruction,
        responseMimeType: 'application/json',
        maxTokens: 4000,
        temperature: 0.7,
      });
    });

    let parsed: GeminiSocialPostSchema & {
      scores?: ScoreEvaluation;
      ai_detection_risk?: number;
    };
    try {
      parsed = JSON.parse(result.text) as GeminiSocialPostSchema & {
        scores?: ScoreEvaluation;
        ai_detection_risk?: number;
      };
    } catch (e) {
      this.logger.error(
        'GeminiPostGeneratorAdapter failed to parse JSON from Gemini',
        {
          traceId,
          raw: result.text.slice(0, 500),
        },
      );
      throw new Error('AI returned invalid JSON for social posts');
    }

    const output: GeneratedPostsMap = {};

    if (parsed.facebook && activeNetworks.includes('facebook')) {
      output.facebook = {
        body: parsed.facebook.body,
        hashtags: parsed.facebook.hashtags ?? [],
      };
    }
    if (parsed.instagram && activeNetworks.includes('instagram')) {
      output.instagram = {
        body: parsed.instagram.body,
        hashtags: parsed.instagram.hashtags ?? [],
        emojis: parsed.instagram.emojis ?? '',
      };
    }
    if (parsed.tiktok && activeNetworks.includes('tiktok')) {
      output.tiktok = {
        body: parsed.tiktok.body,
        hashtags: parsed.tiktok.hashtags ?? [],
        hook: parsed.tiktok.hook ?? '',
      };
    }
    if (parsed.linkedin && activeNetworks.includes('linkedin')) {
      output.linkedin = {
        body: parsed.linkedin.body,
        hashtags: parsed.linkedin.hashtags ?? [],
      };
    }
    if (parsed.twitter && activeNetworks.includes('twitter')) {
      output.twitter = {
        body: parsed.twitter.body,
        hashtags: parsed.twitter.hashtags ?? [],
      };
    }

    const scores: ScoreEvaluation = parsed.scores ?? {
      human_writing_index: 70,
      virality_score: 70,
      engagement_score: 70,
      roi_score: 70,
      trend_alignment: 70,
    };

    const ai_detection_risk = parsed.ai_detection_risk ?? 30;

    this.logger.info('GeminiPostGeneratorAdapter.generatePostsWithFeedback done', {
      traceId,
      scores,
      ai_detection_risk,
    });

    return {
      ...output,
      scores,
      ai_detection_risk,
    };
  }
}
