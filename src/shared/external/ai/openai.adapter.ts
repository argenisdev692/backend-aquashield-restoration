import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  type IAiClient,
  type AiCompleteParams,
  type AiCompleteResult,
  type AiImageParams,
  type AiImageResult,
} from './ai-client.port';
import { type IPolicy } from 'cockatiel';
import { createExternalServicePolicy } from '../resilience';

@Injectable()
export class OpenAiClient implements IAiClient, OnModuleInit {
  private client: OpenAI;
  private resilience!: IPolicy;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER is openai');
    }
    this.client = new OpenAI({ apiKey });
  }

  onModuleInit(): void {
    this.resilience = createExternalServicePolicy('openai', 'ai');
  }

  async complete(params: AiCompleteParams): Promise<AiCompleteResult> {
    const response = await this.resilience.execute(() =>
      this.client.chat.completions.create({
        model: params.model,
        messages: [
          ...(params.systemInstruction
            ? [{ role: 'system' as const, content: params.systemInstruction }]
            : []),
          ...params.messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ],
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        response_format:
          params.responseMimeType === 'application/json'
            ? { type: 'json_object' }
            : undefined,
      }),
    );

    const text = response.choices[0]?.message?.content ?? '';

    return {
      text,
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      },
    };
  }

  async generateImage(params: AiImageParams): Promise<AiImageResult> {
    const response = await this.resilience.execute(() =>
      this.client.images.generate({
        model: params.model,
        prompt: params.prompt,
        response_format: 'b64_json',
      }),
    );

    if (!response.data || response.data.length === 0) {
      throw new Error('OpenAI image generation returned no data');
    }

    const imageData = response.data[0]?.b64_json;
    if (!imageData) {
      throw new Error('OpenAI image generation returned no image data');
    }

    return {
      base64: imageData,
      mimeType: 'image/png',
    };
  }
}
