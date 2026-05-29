import { RefreshTokenHash } from '../value-objects/refresh-token-hash.vo';
import {
  RefreshTokenExpiredException,
  RefreshTokenRevokedException,
} from '../exceptions/auth-domain.exception';

/**
 * Refresh-token session, one row per device. The raw refresh token is shown
 * to the client only at session creation and on every rotation; we persist
 * only the SHA-256 hash.
 *
 * State machine:
 *  active   →  rotated   (refresh): same row, new tokenHash + new lastActivityAt
 *  active   →  revoked   (logout / logout-all / password change / theft)
 *  active   →  expired   (expiresAt < now): not revoked, but unusable
 */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 min
export const REFRESH_TOKEN_TTL_DAYS_USER = 30;
export const REFRESH_TOKEN_TTL_DAYS_ADMIN = 7;

export interface DeviceInfo {
  readonly browser?: string;
  readonly os?: string;
  readonly platform?: string;
  readonly [key: string]: unknown;
}

export class AuthSession {
  private constructor(
    public readonly id: string | null,
    public readonly userId: string,
    private _refreshTokenHash: RefreshTokenHash,
    public readonly deviceInfo: DeviceInfo | null,
    public readonly userAgent: string | null,
    public readonly deviceLabel: string | null,
    public readonly ipAddress: string | null,
    private _lastActivityAt: Date,
    private _revokedAt: Date | null,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(props: {
    userId: string;
    refreshTokenHash: RefreshTokenHash;
    deviceInfo?: DeviceInfo | null;
    userAgent?: string | null;
    deviceLabel?: string | null;
    ipAddress?: string | null;
    ttlDays: number;
    now?: Date;
  }): AuthSession {
    if (!props.userId) throw new Error('AuthSession.userId is required');
    const now = props.now ?? new Date();
    const expiresAt = new Date(
      now.getTime() + props.ttlDays * 24 * 60 * 60 * 1000,
    );
    return new AuthSession(
      null,
      props.userId,
      props.refreshTokenHash,
      props.deviceInfo ?? null,
      props.userAgent ?? null,
      props.deviceLabel ?? null,
      props.ipAddress ?? null,
      now,
      null,
      expiresAt,
      now,
      now,
    );
  }

  static reconstitute(props: {
    id: string;
    userId: string;
    refreshTokenHash: RefreshTokenHash;
    deviceInfo: DeviceInfo | null;
    userAgent: string | null;
    deviceLabel: string | null;
    ipAddress: string | null;
    lastActivityAt: Date;
    revokedAt: Date | null;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): AuthSession {
    return new AuthSession(
      props.id,
      props.userId,
      props.refreshTokenHash,
      props.deviceInfo,
      props.userAgent,
      props.deviceLabel,
      props.ipAddress,
      props.lastActivityAt,
      props.revokedAt,
      props.expiresAt,
      props.createdAt,
      props.updatedAt,
    );
  }

  get refreshTokenHash(): RefreshTokenHash {
    return this._refreshTokenHash;
  }

  get lastActivityAt(): Date {
    return this._lastActivityAt;
  }

  get revokedAt(): Date | null {
    return this._revokedAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  isRevoked(): boolean {
    return this._revokedAt !== null;
  }

  isExpired(now: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  isActive(now: Date = new Date()): boolean {
    return !this.isRevoked() && !this.isExpired(now);
  }

  /**
   * Rotate the refresh token (same row, new hash, bumped lastActivityAt).
   * Throws if the session is not active — caller must classify as
   * `revoked` vs `expired` so the controller returns the right code.
   */
  rotate(newHash: RefreshTokenHash, now: Date = new Date()): void {
    if (this.isRevoked()) throw new RefreshTokenRevokedException();
    if (this.isExpired(now)) throw new RefreshTokenExpiredException();
    this._refreshTokenHash = newHash;
    this._lastActivityAt = now;
    this._updatedAt = now;
  }

  /** Bump lastActivityAt without rotating (e.g. /auth/me). */
  touch(now: Date = new Date()): void {
    if (!this.isActive(now)) return;
    this._lastActivityAt = now;
    this._updatedAt = now;
  }

  revoke(now: Date = new Date()): void {
    if (this._revokedAt !== null) return; // idempotent
    this._revokedAt = now;
    this._updatedAt = now;
  }
}
