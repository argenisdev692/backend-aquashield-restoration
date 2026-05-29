/**
 * Fired after a user successfully confirms TOTP setup and we persist
 * `totp_enabled = true` + the bcrypt-hashed backup codes. Listener emails
 * the user that 2FA is now active.
 */
export class TwoFactorEnabledEvent {
  static readonly name = 'auth.two_factor.enabled';

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly backupCodesIssued: number,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

/**
 * Symmetric event for opt-out — listener emails the user that 2FA was disabled
 * (potential takeover signal).
 */
export class TwoFactorDisabledEvent {
  static readonly name = 'auth.two_factor.disabled';

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
