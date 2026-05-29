/**
 * Fired when an account is locked after exceeding the consecutive failure
 * threshold (default 10 failures in window). Listeners email the owner and
 * audit-log the event.
 */
export class AccountLockedEvent {
  static readonly name = 'auth.account.locked';

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly lockedUntil: Date,
    public readonly ipAddress: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
