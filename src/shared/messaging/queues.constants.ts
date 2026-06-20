/**
 * Canonical BullMQ queue names.
 *
 * Feature modules register their own queue with `BullModule.registerQueue`
 * using one of these names — never hardcode the string at the call site.
 */
export const QUEUE_NAMES = {
  /**
   * Single queue for ALL transactional emails (auth OTP/verification/reset,
   * appointment notifications, contact-support, retell call alerts, …).
   * Senders enqueue an already-rendered `{ to, subject, html }` job; the shared
   * `EmailProcessor` delivers it through the transport + circuit breaker.
   */
  EMAIL: 'email',
  EXPORT: 'export',
  NOTIFICATIONS: 'notifications',
  AI_GENERATION: 'ai-generation',
  SOCIAL_MEDIA_GENERATION: 'social-media-generation',
  CAMPAIGN_EXPORT: 'campaign-export',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
