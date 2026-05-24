/**
 * Tokens and constants for the shared messaging / BullMQ infrastructure.
 *
 * We deliberately use a dedicated Redis connection for messaging (BullMQ)
 * instead of reusing the cache's REDIS_CLIENT. This gives us:
 * - Independent connection lifecycle and configuration (BullMQ requires maxRetriesPerRequest=null).
 * - Clear separation of concerns.
 * - Ability to scale / monitor messaging traffic separately in the future.
 */

export const MESSAGING_REDIS_CONNECTION = Symbol('MESSAGING_REDIS_CONNECTION');
