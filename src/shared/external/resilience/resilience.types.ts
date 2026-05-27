/**
 * Resilience layer for external service calls (HTTP, AI providers, email, research, etc.).
 *
 * This is infrastructure-only. Application layer (handlers / use cases) MUST NOT
 * import or depend on anything from this folder.
 *
 * Purpose:
 * - Centralize cockatiel policy creation.
 * - Provide consistent retry + circuit breaker behavior across all outbound integrations.
 * - Make it easy to evolve (add metrics, tracing, change library) in one place.
 */

import type { IPolicy } from 'cockatiel';

export type ExternalServiceProfile =
  | 'ai' // LLM calls (Gemini, OpenAI, Anthropic...) — higher timeouts
  | 'research' // Web search / grounding APIs (Tavily, etc.)
  | 'email' // Transactional email (Resend, SendGrid...)
  | 'http-default'; // Generic outbound HTTP

export interface ResiliencePolicyConfig {
  maxRetries: number;
  initialDelayMs: number;
  halfOpenAfterMs: number;
  failureThreshold: number;
}

/**
 * The factory returns a cockatiel IPolicy.
 * Consumers treat it as an opaque resilience wrapper — they never import cockatiel directly.
 */
export type CreatePolicy = (
  serviceName: string,
  profile?: ExternalServiceProfile,
) => IPolicy;
