/**
 * Cache TTL tiers (seconds). Never use magic numbers — every `@CacheTTL()`
 * MUST reference one of these constants.
 */
export const TTL_SECONDS = {
  /** Frequently mutated: user lists, order statuses. */
  SHORT: 30,
  /** Semi-stable: roles, permissions, preferences. */
  MEDIUM: 300,
  /** Stable reference: country lists, plan tiers. */
  LONG: 3600,
  /** Immutable: lookup tables, enums, i18n strings. */
  STATIC: 86_400,
} as const;

export type TtlTier = (typeof TTL_SECONDS)[keyof typeof TTL_SECONDS];

/** DI token for the shared ioredis connection. */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
