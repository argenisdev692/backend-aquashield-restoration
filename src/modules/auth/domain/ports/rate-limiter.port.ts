/**
 * Port for the Redis-backed rate limiter / brute-force counter.
 *
 * The dedicated counter helpers (`recordFailedLogin`, `consumeFailedLogins`)
 * are kept distinct from generic `@nestjs/throttler`: throttler shields a
 * route from raw traffic, while this port tracks the per-account state
 * machine that drives the AccountLocked invariant.
 *
 * `recordFailedLogin` returns the running count AFTER the increment so the
 * use-case can decide whether to lock the account.
 */
export interface IAuthRateLimiter {
  /**
   * Increment the failed-login counter for `key` and return the new count.
   * TTL on the underlying Redis key matches FAILED_LOGIN_WINDOW_SECONDS.
   *
   * @param key  e.g. `login:fail:user:${userId}`
   */
  recordFailure(key: string, windowSeconds: number): Promise<number>;

  /** Clear the counter on successful login. */
  clearFailures(key: string): Promise<void>;

  /** Read the current failure count without incrementing. */
  getFailures(key: string): Promise<number>;

  /**
   * Generic per-IP throttle helper for endpoints that don't have a userId
   * yet (register, forgot-password). Returns the new count after increment.
   */
  recordIpHit(key: string, windowSeconds: number): Promise<number>;
}

export const AUTH_RATE_LIMITER = Symbol('IAuthRateLimiter');
