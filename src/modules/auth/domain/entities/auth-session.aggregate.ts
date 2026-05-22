import { RefreshToken } from '../value-objects/refresh-token.vo';

export interface DeviceInfo {
  userAgent?: string;
  ip?: string;
  platform?: string;
}

/**
 * Best-effort label derived from a User-Agent string. Pure function so it can
 * live next to the aggregate without dragging UA-parser dependencies into the
 * domain. Falls back to a short slice of the raw UA when no pattern matches.
 */
export function deviceLabelFromUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const browser = /(Chrome|Firefox|Safari|Edg|Opera|Brave)/i.exec(ua)?.[1];
  const os = /(Windows|Mac OS X|Android|iPhone|iPad|Linux)/i.exec(ua)?.[1];
  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return ua.slice(0, 64);
}

export class AuthSession {
  // `_revokedAt` and `_lastActivityAt` are the only mutable fields.
  private _revokedAt: Date | null;
  private _lastActivityAt: Date;

  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly refreshToken: RefreshToken,
    public readonly deviceInfo: DeviceInfo | null,
    public readonly userAgent: string | null,
    public readonly deviceLabel: string | null,
    public readonly ipAddress: string | null,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
    lastActivityAt: Date,
    revokedAt: Date | null,
  ) {
    this._revokedAt = revokedAt;
    this._lastActivityAt = lastActivityAt;
  }

  static create(params: {
    id: string;
    userId: string;
    refreshToken: RefreshToken;
    deviceInfo?: DeviceInfo | null;
    userAgent?: string | null;
    deviceLabel?: string | null;
    ipAddress?: string | null;
    expiresAt: Date;
    createdAt?: Date;
    lastActivityAt?: Date;
  }): AuthSession {
    const now = params.createdAt ?? new Date();
    return new AuthSession(
      params.id,
      params.userId,
      params.refreshToken,
      params.deviceInfo ?? null,
      params.userAgent ?? null,
      params.deviceLabel ?? deviceLabelFromUserAgent(params.userAgent),
      params.ipAddress ?? null,
      params.expiresAt,
      now,
      params.lastActivityAt ?? now,
      null,
    );
  }

  static reconstitute(params: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    deviceInfo: DeviceInfo | null;
    userAgent: string | null;
    deviceLabel: string | null;
    ipAddress: string | null;
    expiresAt: Date;
    createdAt: Date;
    lastActivityAt: Date;
    revokedAt: Date | null;
  }): AuthSession {
    return new AuthSession(
      params.id,
      params.userId,
      RefreshToken.fromHash(params.refreshTokenHash),
      params.deviceInfo,
      params.userAgent,
      params.deviceLabel,
      params.ipAddress,
      params.expiresAt,
      params.createdAt,
      params.lastActivityAt,
      params.revokedAt,
    );
  }

  revoke(): void {
    this._revokedAt = new Date();
  }

  touch(at: Date = new Date()): void {
    this._lastActivityAt = at;
  }

  get revokedAt(): Date | null {
    return this._revokedAt;
  }

  get lastActivityAt(): Date {
    return this._lastActivityAt;
  }

  get isRevoked(): boolean {
    return this._revokedAt !== null;
  }

  get isExpired(): boolean {
    return Date.now() > this.expiresAt.getTime();
  }

  get isActive(): boolean {
    return !this.isRevoked && !this.isExpired;
  }
}
