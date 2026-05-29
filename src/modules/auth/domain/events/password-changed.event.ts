/**
 * Fired after a user's password hash is persisted (reset OR change flow).
 * Listeners:
 *  - revoke all OTHER auth sessions (keep the current one if known)
 *  - email the owner a notification
 */
export type PasswordChangeSource = 'change' | 'reset' | 'admin_reset';

export class PasswordChangedEvent {
  static readonly name = 'auth.password.changed';

  constructor(
    public readonly userId: string,
    public readonly source: PasswordChangeSource,
    public readonly keepSessionId: string | null,
    public readonly ipAddress: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
