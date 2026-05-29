import { AuthSession } from '../entities/auth-session.entity';

export interface IAuthSessionRepository {
  /** Persist a brand-new session. Returns the assigned id. */
  create(session: AuthSession): Promise<string>;

  /**
   * Persist mutations on an existing session: rotation (refreshTokenHash +
   * lastActivityAt), touch (lastActivityAt), revoke (revokedAt).
   */
  save(session: AuthSession): Promise<void>;

  findById(id: string): Promise<AuthSession | null>;

  /**
   * Lookup by the SHA-256 hash of the raw refresh token. Returns the row
   * regardless of revoke/expiry state — the caller decides how to react.
   */
  findByRefreshTokenHash(hash: string): Promise<AuthSession | null>;

  /** All active (non-revoked, non-expired) sessions for a user, newest first. */
  findActiveByUserId(userId: string, now?: Date): Promise<AuthSession[]>;

  /**
   * Revoke ALL sessions for a user. If `exceptSessionId` is provided, that
   * session stays active (used by "logout all other devices" and by the
   * password-change side effect that keeps the current session alive).
   * Returns the ids of the rows revoked.
   */
  revokeAllForUser(
    userId: string,
    options?: { exceptSessionId?: string; now?: Date },
  ): Promise<string[]>;

  /** Revoke a single session by id. Idempotent. */
  revokeById(id: string, now?: Date): Promise<void>;
}

export const AUTH_SESSION_REPOSITORY = Symbol('IAuthSessionRepository');
