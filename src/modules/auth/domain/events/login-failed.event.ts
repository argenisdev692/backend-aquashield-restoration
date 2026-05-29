/**
 * Fired on every failed login attempt — credentials, locked account, 2FA, etc.
 * Listeners audit-log the attempt; we do NOT email the user (would enable
 * user-enumeration via timing).
 */
export type LoginFailureReason =
  | 'invalid_credentials'
  | 'account_locked'
  | 'email_not_verified'
  | 'two_factor_invalid'
  | 'backup_code_invalid';

export class LoginFailedEvent {
  static readonly name = 'auth.login.failed';

  constructor(
    public readonly email: string,
    public readonly reason: LoginFailureReason,
    public readonly ipAddress: string | null,
    public readonly userAgent: string | null,
    public readonly userId: string | null = null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
