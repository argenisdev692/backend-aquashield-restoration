/**
 * Fired when one or more auth sessions are revoked (logout, logout-all,
 * password change, admin force-logout). Listener audit-logs each revocation.
 */
export type SessionRevocationReason =
  | 'logout'
  | 'logout_all'
  | 'password_changed'
  | 'admin_revoke'
  | 'session_theft'
  | 'two_factor_disabled';

export class SessionRevokedEvent {
  static readonly name = 'auth.session.revoked';

  constructor(
    public readonly userId: string,
    public readonly sessionIds: readonly string[],
    public readonly reason: SessionRevocationReason,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
