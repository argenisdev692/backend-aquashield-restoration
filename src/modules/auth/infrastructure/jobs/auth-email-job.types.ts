/**
 * Discriminated union of every auth transactional email payload. The
 * `QueuedAuthEmailAdapter` adds a job with `name = kind` so the processor
 * dispatches by `job.name` instead of a runtime switch on the payload.
 *
 * Every payload carries the `to` recipient and optional context
 * (IP / user-agent) so the rendered email shows the requesting device
 * — critical for the suspicious-activity flow.
 */
export type AuthEmailJob =
  | {
      kind: 'email_verification';
      to: string;
      code: string;
      expiresInMinutes: number;
    }
  | {
      kind: 'password_reset_requested';
      to: string;
      code: string;
      expiresInMinutes: number;
      ipAddress: string | null;
      userAgent: string | null;
    }
  | {
      kind: 'password_reset_completed';
      to: string;
      ipAddress: string | null;
      occurredAtIso: string;
    }
  | {
      kind: 'new_device_alert';
      to: string;
      deviceLabel: string | null;
      userAgent: string | null;
      ipAddress: string | null;
      occurredAtIso: string;
    }
  | {
      kind: 'password_changed';
      to: string;
      ipAddress: string | null;
      occurredAtIso: string;
    }
  | {
      kind: 'account_locked';
      to: string;
      lockedUntilIso: string;
      ipAddress: string | null;
    }
  | {
      kind: 'suspicious_activity';
      to: string;
      reason:
        | 'repeated_failed_logins'
        | 'failed_two_factor'
        | 'unusual_location';
      failedAttempts: number;
      ipAddress: string | null;
      userAgent: string | null;
      occurredAtIso: string;
    }
  | {
      kind: 'two_factor_enabled';
      to: string;
      ipAddress: string | null;
    }
  | {
      kind: 'two_factor_disabled';
      to: string;
      ipAddress: string | null;
    }
  | {
      kind: 'social_account_linked';
      to: string;
      provider: 'google';
      ipAddress: string | null;
      occurredAtIso: string;
    };

export type AuthEmailJobKind = AuthEmailJob['kind'];
