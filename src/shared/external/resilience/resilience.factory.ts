import {
  circuitBreaker,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  retry,
  wrap,
  type IPolicy,
} from 'cockatiel';
import { RESILIENCE_PROFILES, DEFAULT_PROFILE } from './resilience.constants';
import type { ExternalServiceProfile } from './resilience.types';

/**
 * Creates a consistent retry + circuit breaker policy for outbound external services.
 *
 * This is the single source of truth for resilience behavior on all external calls
 * (AI, research, email, generic HTTP, etc.).
 *
 * @param serviceName - Logical name for logging / future metrics (e.g. 'tavily', 'gemini')
 * @param profile   - Predefined profile that controls timeouts and thresholds
 */
export function createExternalServicePolicy(
  serviceName: string,
  profile: ExternalServiceProfile = 'http-default',
): IPolicy {
  const config = RESILIENCE_PROFILES[profile] ?? DEFAULT_PROFILE;

  const retryPolicy = retry(handleAll, {
    maxAttempts: config.maxRetries + 1,
    backoff: new ExponentialBackoff({ initialDelay: config.initialDelayMs }),
  });

  const breaker = circuitBreaker(handleAll, {
    halfOpenAfter: config.halfOpenAfterMs,
    breaker: new ConsecutiveBreaker(config.failureThreshold),
  });

  const policy = wrap(retryPolicy, breaker);

  // Future enhancement point: wrap with logging / metrics here if desired.
  // Example: return withLogging(policy, serviceName);

  return policy;
}

/**
 * Circuit-breaker-ONLY policy (no inner retry).
 *
 * Use this when retries are already owned by an outer mechanism — e.g. a BullMQ
 * worker whose job-level `attempts` + exponential `backoff` re-run the handler
 * on failure. Adding {@link createExternalServicePolicy}'s inner retry there
 * would compound (BullMQ attempts × policy attempts) and hammer the provider.
 * The breaker still short-circuits during a sustained outage and re-tests after
 * `halfOpenAfterMs`, so the instance MUST be created once and reused across
 * invocations to preserve consecutive-failure state.
 *
 * @param serviceName - Logical name for logging / future metrics.
 * @param profile   - Profile supplying `failureThreshold` + `halfOpenAfterMs`.
 */
export function createCircuitBreakerOnlyPolicy(
  serviceName: string,
  profile: ExternalServiceProfile = 'http-default',
): IPolicy {
  const config = RESILIENCE_PROFILES[profile] ?? DEFAULT_PROFILE;

  return circuitBreaker(handleAll, {
    halfOpenAfter: config.halfOpenAfterMs,
    breaker: new ConsecutiveBreaker(config.failureThreshold),
  });
}
