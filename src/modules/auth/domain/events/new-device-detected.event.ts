/**
 * Fired when a login succeeds from a (user-agent, ip-class) combo not seen
 * before for the user. Listener sends a "new device sign-in" email.
 */
export class NewDeviceDetectedEvent {
  static readonly name = 'auth.device.new';

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly sessionId: string,
    public readonly deviceLabel: string | null,
    public readonly userAgent: string | null,
    public readonly ipAddress: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
