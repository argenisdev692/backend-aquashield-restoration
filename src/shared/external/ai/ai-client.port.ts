export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompleteParams {
  model: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
  responseMimeType?: 'text/plain' | 'application/json';
  /** Optional: for providers that support it (e.g. Gemini) */
  systemInstruction?: string;
}

export interface AiCompleteResult {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface AiImageParams {
  model: string;
  prompt: string;
}

export interface AiImageResult {
  base64: string;
  mimeType: string;
}

/**
 * Generic AI client port for text + structured output + optional image generation.
 * Implementations: Gemini, Anthropic, OpenAI, Replicate, etc.
 *
 * Business prompts (E-E-A-T rules, SEO JSON schema, humanization, image prompts)
 * live in the consuming bounded context (e.g. posts module), not here.
 */
export interface IAiClient {
  complete(params: AiCompleteParams): Promise<AiCompleteResult>;
  generateImage?(params: AiImageParams): Promise<AiImageResult>;
}

export const AI_CLIENT = Symbol('IAiClient');
