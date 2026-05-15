/**
 * Canonical BullMQ queue names.
 *
 * Feature modules register their own queue with `BullModule.registerQueue`
 * using one of these names — never hardcode the string at the call site.
 */
export const QUEUE_NAMES = {
  EMAIL: 'email',
  EXPORT: 'export',
  NOTIFICATIONS: 'notifications',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
