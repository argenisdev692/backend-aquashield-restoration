import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import {
  type IAiClient,
  type AiCompleteParams,
  type AiCompleteResult,
  type AiImageParams,
  type AiImageResult,
} from './ai-client.port';
import { AI_DEFAULT_TIMEOUT_MS } from './ai.constants';
import { type IPolicy } from 'cockatiel';
import { createExternalServicePolicy } from '../resilience';

@Injectable()
export class GeminiAiClient implements IAiClient, OnModuleInit {
  private client: GoogleGenAI;
  private resilience!: IPolicy;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
    this.client = new GoogleGenAI({ apiKey });
  }

  onModuleInit(): void {
    // Centralized resilience policy for AI calls.
    // 'ai' profile has higher timeouts and slightly more permissive breaker (typical for LLM providers).
    this.resilience = createExternalServicePolicy('gemini', 'ai');
  }

  async complete(params: AiCompleteParams): Promise<AiCompleteResult> {
    const response = await this.resilience.execute(() =>
      this.client.models.generateContent({
        model: params.model,
        contents: params.messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : m.role,
          parts: [{ text: m.content }],
        })),
        config: {
          systemInstruction: params.systemInstruction,
          maxOutputTokens: params.maxTokens,
          temperature: params.temperature,
          responseMimeType: params.responseMimeType,
        },
      }),
    );

    return {
      text: response.text ?? '',
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount ?? undefined,
        completionTokens:
          response.usageMetadata?.candidatesTokenCount ?? undefined,
        totalTokens: response.usageMetadata?.totalTokenCount ?? undefined,
      },
    };
  }

  async generateImage(params: AiImageParams): Promise<AiImageResult> {
    const response = await this.resilience.execute(() =>
      this.client.models.generateContent({
        model: params.model,
        contents: params.prompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    );

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData) {
        return {
          base64: part.inlineData.data ?? '',
          mimeType: part.inlineData.mimeType ?? 'image/png',
        };
      }
    }

    throw new Error('Gemini image generation returned no inline data');
  }
}
