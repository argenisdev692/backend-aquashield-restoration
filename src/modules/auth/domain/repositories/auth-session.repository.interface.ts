import type { AuthSession } from '../entities/auth-session.aggregate';

export interface IAuthSessionRepository {
  save(session: AuthSession): Promise<void>;
  findByRefreshToken(token: string): Promise<AuthSession | null>;
  findByUserId(userId: string): Promise<AuthSession[]>;
  revokeAllForUser(userId: string): Promise<void>;
  revokeById(sessionId: string): Promise<void>;
  /** Revokes only when the session belongs to the given user. Returns true on success. */
  revokeByIdForUser(sessionId: string, userId: string): Promise<boolean>;
  /** Bumps lastActivityAt to now (or the given date). No-op when already revoked. */
  touch(sessionId: string, at?: Date): Promise<void>;
  /**
   * True when the user already has an active (non-revoked, non-expired)
   * session sharing this user-agent OR ip. Drives the new-device alert.
   */
  hasMatchingActiveSession(
    userId: string,
    userAgent: string | null,
    ipAddress: string | null,
  ): Promise<boolean>;
}

export const AUTH_SESSION_REPOSITORY = Symbol('IAuthSessionRepository');
