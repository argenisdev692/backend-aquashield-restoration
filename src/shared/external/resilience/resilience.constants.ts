import type { ResiliencePolicyConfig } from './resilience.types';

/**
 * Default resilience profiles for external services.
 *
 * These are tuned for typical SaaS external APIs in 2026.
 * Adjust per environment if needed (future enhancement: load from ConfigService).
 */
export const RESILIENCE_PROFILES: Record<string, ResiliencePolicyConfig> = {
  ai: {
    maxRetries: 2,
    initialDelayMs: 800,
    halfOpenAfterMs: 45_000,
    failureThreshold: 4,
  },
  research: {
    maxRetries: 1,
    initialDelayMs: 600,
    halfOpenAfterMs: 30_000,
    failureThreshold: 3,
  },
  email: {
    maxRetries: 3,
    initialDelayMs: 1200,
    halfOpenAfterMs: 60_000,
    failureThreshold: 5,
  },
  'http-default': {
    maxRetries: 2,
    initialDelayMs: 500,
    halfOpenAfterMs: 30_000,
    failureThreshold: 3,
  },
};

/** Fallback when an unknown profile is requested. */
export const DEFAULT_PROFILE: ResiliencePolicyConfig =
  RESILIENCE_PROFILES['http-default'];
