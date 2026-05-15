import type { AuthSession } from '../entities/auth-session.aggregate';

export interface IAuthSessionRepository {
  save(session: AuthSession): Promise<void>;
  findByRefreshToken(token: string): Promise<AuthSession | null>;
  findByUserId(userId: string): Promise<AuthSession[]>;
  revokeAllForUser(userId: string): Promise<void>;
  revokeById(sessionId: string): Promise<void>;
}

export const AUTH_SESSION_REPOSITORY = Symbol('IAuthSessionRepository');
