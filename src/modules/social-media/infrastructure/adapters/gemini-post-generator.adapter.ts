import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import {
  AI_CLIENT,
  type IAiClient,
} from '../../../../shared/external/ai/ai-client.port';
import type {
  IPostGeneratorPort,
  GeneratePostsInput,
  GeneratedPostsMap,
} from '../../domain/ports/post-generator.port';
import type { SocialNetwork } from '../../domain/entities/social-media-generation.entity';

interface GeminiSocialPostSchema {
  facebook?: { body: string; hashtags: string[] };
  instagram?: { body: string; hashtags: string[]; emojis: string };
  tiktok?: { body: string; hashtags: string[]; hook: string };
  linkedin?: { body: string; hashtags: string[] };
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
  },
  additionalProperties: false,
};

@Injectable()
export class GeminiPostGeneratorAdapter implements IPostGeneratorPort {
  private readonly model: string;

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

  async generatePosts(input: GeneratePostsInput): Promise<GeneratedPostsMap> {
    const traceId = this.cls.get<string>('traceId');
    const {
      topicTitle,
      topicDescription,
      activeNetworks,
      language = 'es',
    } = input;

    this.logger.info('GeminiPostGeneratorAdapter.generatePosts start', {
      traceId,
      networks: activeNetworks,
    });

    const networkList = activeNetworks.join(', ');
    const systemInstruction = `Eres un experto copywriter de redes sociales en español (o el idioma indicado).
Genera posts optimizados para las siguientes plataformas: ${networkList}.
Responde EXCLUSIVAMENTE con JSON válido que cumpla exactamente este schema (sin markdown, sin explicaciones):

${JSON.stringify(SOCIAL_POST_JSON_SCHEMA, null, 2)}

Reglas por plataforma:
- facebook: conversacional, 150-300 palabras, 5-8 hashtags.
- instagram: visual, con emojis, 80-150 palabras, 10-15 hashtags. El campo "emojis" debe ser un string con 3-6 emojis separados por espacio.
- tiktok: hook poderoso en la primera línea (campo "hook"), lenguaje joven, 50-80 palabras, 8-12 hashtags.
- linkedin: profesional, valor de negocio, 150-250 palabras, 3-5 hashtags.

Solo incluye en el JSON las claves de las redes que el usuario pidió activar.
Si una red no está activa, NO la incluyas en la respuesta JSON.`;

    const userPrompt = `Nicho: ${topicTitle}
Descripción del tema: ${topicDescription}
Idioma objetivo: ${language}
Redes activas: ${networkList}

Genera los posts ahora.`;

    const result = await this.aiClient.complete({
      model: this.model,
      messages: [{ role: 'user', content: userPrompt }],
      systemInstruction,
      responseMimeType: 'application/json',
      maxTokens: 4000,
      temperature: 0.7,
    });

    let parsed: GeminiSocialPostSchema;
    try {
      parsed = JSON.parse(result.text) as GeminiSocialPostSchema;
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

    this.logger.info('GeminiPostGeneratorAdapter.generatePosts done', {
      traceId,
    });

    return output;
  }
}
