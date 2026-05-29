/**
 * Fired BEFORE the account-lockout threshold is reached so the legitimate
 * owner is warned in time. The listener emails a "we noticed unusual
 * activity" alert with the IP / user-agent.
 *
 * Use cases:
 *  - half-threshold failed logins on the same account
 *  - repeated failed 2FA codes
 *  - login attempts from unusual geolocation (future)
 */
export type SuspiciousActivityReason =
  | 'repeated_failed_logins'
  | 'failed_two_factor'
  | 'unusual_location';

export class SuspiciousActivityDetectedEvent {
  static readonly name = 'auth.activity.suspicious';

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly reason: SuspiciousActivityReason,
    public readonly failedAttempts: number,
    public readonly ipAddress: string | null,
    public readonly userAgent: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

/**
 * Fired the moment a password reset is REQUESTED (forgot-password). The
 * listener emails the OTP + the requesting IP. The owner can spot a reset
 * attempt they did not initiate.
 */
export class PasswordResetRequestedEvent {
  static readonly name = 'auth.password.reset_requested';

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly code: string,
    public readonly expiresInMinutes: number,
    public readonly ipAddress: string | null,
    public readonly userAgent: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

/**
 * Fired when a social provider is linked. Lets the owner detect unauthorised
 * linking via a compromised social account.
 */
export class SocialAccountLinkedEvent {
  static readonly name = 'auth.social.linked';

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly provider: 'google',
    public readonly ipAddress: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
