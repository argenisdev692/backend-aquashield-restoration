import { RefreshToken } from '../value-objects/refresh-token.vo';

export interface DeviceInfo {
  userAgent?: string;
  ip?: string;
  platform?: string;
}

export class AuthSession {
  // `_revokedAt` is the only mutable field; everything else is final.
  private _revokedAt: Date | null;

  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly refreshToken: RefreshToken,
    public readonly deviceInfo: DeviceInfo | null,
    public readonly ipAddress: string | null,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
    revokedAt: Date | null,
  ) {
    this._revokedAt = revokedAt;
  }

  static create(params: {
    id: string;
    userId: string;
    refreshToken: RefreshToken;
    deviceInfo?: DeviceInfo | null;
    ipAddress?: string | null;
    expiresAt: Date;
    createdAt?: Date;
  }): AuthSession {
    return new AuthSession(
      params.id,
      params.userId,
      params.refreshToken,
      params.deviceInfo ?? null,
      params.ipAddress ?? null,
      params.expiresAt,
      params.createdAt ?? new Date(),
      null,
    );
  }

  static reconstitute(params: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    deviceInfo: DeviceInfo | null;
    ipAddress: string | null;
    expiresAt: Date;
    createdAt: Date;
    revokedAt: Date | null;
  }): AuthSession {
    return new AuthSession(
      params.id,
      params.userId,
      RefreshToken.fromHash(params.refreshTokenHash),
      params.deviceInfo,
      params.ipAddress,
      params.expiresAt,
      params.createdAt,
      params.revokedAt,
    );
  }

  revoke(): void {
    this._revokedAt = new Date();
  }

  get revokedAt(): Date | null {
    return this._revokedAt;
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
