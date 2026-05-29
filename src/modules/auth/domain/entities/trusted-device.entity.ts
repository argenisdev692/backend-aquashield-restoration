/**
 * A device that may skip 2FA for up to TRUSTED_DEVICE_TTL_DAYS. The cookie
 * delivered to the client carries the raw token; only the SHA-256 hash is
 * persisted.
 */
export const TRUSTED_DEVICE_TTL_DAYS = 30;

export class TrustedDevice {
  private constructor(
    public readonly id: string | null,
    public readonly userId: string,
    public readonly deviceTokenHash: string,
    public readonly label: string | null,
    public readonly userAgent: string | null,
    public readonly ipAddress: string | null,
    public readonly expiresAt: Date,
    private _lastUsedAt: Date,
    public readonly createdAt: Date,
  ) {}

  static create(props: {
    userId: string;
    deviceTokenHash: string;
    label?: string | null;
    userAgent?: string | null;
    ipAddress?: string | null;
    now?: Date;
  }): TrustedDevice {
    const now = props.now ?? new Date();
    const expiresAt = new Date(
      now.getTime() + TRUSTED_DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    return new TrustedDevice(
      null,
      props.userId,
      props.deviceTokenHash,
      props.label ?? null,
      props.userAgent ?? null,
      props.ipAddress ?? null,
      expiresAt,
      now,
      now,
    );
  }

  static reconstitute(props: {
    id: string;
    userId: string;
    deviceTokenHash: string;
    label: string | null;
    userAgent: string | null;
    ipAddress: string | null;
    expiresAt: Date;
    lastUsedAt: Date;
    createdAt: Date;
  }): TrustedDevice {
    return new TrustedDevice(
      props.id,
      props.userId,
      props.deviceTokenHash,
      props.label,
      props.userAgent,
      props.ipAddress,
      props.expiresAt,
      props.lastUsedAt,
      props.createdAt,
    );
  }

  get lastUsedAt(): Date {
    return this._lastUsedAt;
  }

  isExpired(now: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  touch(now: Date = new Date()): void {
    this._lastUsedAt = now;
  }
}
