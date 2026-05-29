/**
 * Fired after a successful login + (optional) 2FA challenge — i.e. when a new
 * AuthSession is persisted. Listeners drive:
 *  - new-device email alert (when deviceFingerprint not in trusted devices)
 *  - audit log entry
 */
export class LoginSucceededEvent {
  static readonly name = 'auth.login.succeeded';

  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly deviceFingerprint: string,
    public readonly ipAddress: string | null,
    public readonly userAgent: string | null,
    public readonly isNewDevice: boolean,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
