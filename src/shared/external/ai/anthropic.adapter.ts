import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  type IAiClient,
  type AiCompleteParams,
  type AiCompleteResult,
} from './ai-client.port';
import { AI_DEFAULT_TIMEOUT_MS } from './ai.constants';
import { type IPolicy } from 'cockatiel';
import { createExternalServicePolicy } from '../resilience';

@Injectable()
export class AnthropicAiClient implements IAiClient, OnModuleInit {
  private client: Anthropic;
  private resilience!: IPolicy;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is required when AI_PROVIDER is anthropic',
      );
    }
    this.client = new Anthropic({ apiKey });
  }

  onModuleInit(): void {
    this.resilience = createExternalServicePolicy('anthropic', 'ai');
  }

  async complete(params: AiCompleteParams): Promise<AiCompleteResult> {
    const response = await this.resilience.execute(() =>
      this.client.messages.create({
        model: params.model,
        max_tokens: params.maxTokens ?? 4096,
        system: params.systemInstruction,
        messages: params.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        temperature: params.temperature,
      }),
    );

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');

    return {
      text,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
}
