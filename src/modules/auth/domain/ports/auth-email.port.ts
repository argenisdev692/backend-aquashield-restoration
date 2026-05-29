/**
 * Port for transactional auth emails. Adapter wraps the shared `IMailer`.
 * All methods fire-and-forget at the use-case level (called via the event
 * listener, OUTSIDE the surrounding transaction).
 *
 * Suspicious-activity alerts (`sendSuspiciousActivityAlert`,
 * `sendPasswordResetRequested`, `sendPasswordResetCompleted`,
 * `sendNewDeviceAlert`, `sendAccountLockedNotification`,
 * `sendTwoFactorDisabledNotification`) deliberately surface
 * security-relevant state changes so the legitimate owner can act FAST
 * if it wasn't them (the spec's "audit + alert" requirement).
 */
export interface IAuthEmailService {
  sendEmailVerification(input: {
    to: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<void>;

  /**
   * Sent when the user REQUESTS a password reset (forgot-password flow).
   * Always sent on a hit so attackers cannot enumerate accounts via
   * timing — when the email does not exist we still simulate latency but
   * skip the call. Includes the OTP and the requesting IP.
   */
  sendPasswordResetRequested(input: {
    to: string;
    code: string;
    expiresInMinutes: number;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void>;

  /**
   * Sent the moment the password is actually reset successfully. Lets the
   * owner detect compromise immediately (separate from the request email).
   */
  sendPasswordResetCompleted(input: {
    to: string;
    ipAddress: string | null;
    occurredAt: Date;
  }): Promise<void>;

  sendNewDeviceAlert(input: {
    to: string;
    deviceLabel: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    occurredAt: Date;
  }): Promise<void>;

  sendPasswordChangedNotification(input: {
    to: string;
    ipAddress: string | null;
    occurredAt: Date;
  }): Promise<void>;

  sendAccountLockedNotification(input: {
    to: string;
    lockedUntil: Date;
    ipAddress: string | null;
  }): Promise<void>;

  /**
   * Sent on the Nth failed login attempt BEFORE the account is locked
   * (typically after half the lockout threshold). Gives the owner a chance
   * to react to a brute-force attempt without yet inconveniencing them.
   */
  sendSuspiciousActivityAlert(input: {
    to: string;
    reason: 'repeated_failed_logins' | 'failed_two_factor' | 'unusual_location';
    failedAttempts: number;
    ipAddress: string | null;
    userAgent: string | null;
    occurredAt: Date;
  }): Promise<void>;

  sendTwoFactorEnabledNotification(input: {
    to: string;
    ipAddress: string | null;
  }): Promise<void>;

  sendTwoFactorDisabledNotification(input: {
    to: string;
    ipAddress: string | null;
  }): Promise<void>;

  /**
   * Sent when a social provider (e.g. Google) is linked to the account —
   * lets the owner detect unauthorised linking.
   */
  sendSocialAccountLinked(input: {
    to: string;
    provider: 'google';
    ipAddress: string | null;
    occurredAt: Date;
  }): Promise<void>;
}

export const AUTH_EMAIL_SERVICE = Symbol('IAuthEmailService');
