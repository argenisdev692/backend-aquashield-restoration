/**
 * Canonical BullMQ queue names.
 *
 * Feature modules register their own queue with `BullModule.registerQueue`
 * using one of these names — never hardcode the string at the call site.
 */
export const QUEUE_NAMES = {
  EMAIL: 'email',
  /**
   * Dedicated queue for auth transactional emails (OTP, verification,
   * password reset, suspicious-activity alerts, 2FA notifications).
   * Kept separate from the generic EMAIL queue so a backlog on marketing /
   * notification emails cannot delay a login OTP.
   */
  AUTH_EMAIL: 'auth-email',
  EXPORT: 'export',
  NOTIFICATIONS: 'notifications',
  AI_GENERATION: 'ai-generation',
  SOCIAL_MEDIA_GENERATION: 'social-media-generation',
  CAMPAIGN_EXPORT: 'campaign-export',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
