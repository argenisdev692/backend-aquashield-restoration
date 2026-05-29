import { Inject, Injectable } from '@nestjs/common';
import {
  AUTH_SESSION_REPOSITORY,
  type IAuthSessionRepository,
} from '../../domain/ports/auth-session.repository.port';
import type { ActiveSessionsResponse } from '../presenters/session.response';

/**
 * Read-only list of every active (non-revoked, non-expired) session for the
 * calling user. The session that issued the calling JWT is flagged with
 * `isCurrent: true` so the UI can prevent the user from revoking it by
 * accident.
 */
@Injectable()
export class ListActiveSessionsUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: IAuthSessionRepository,
  ) {}

  async execute(args: {
    userId: string;
    currentSessionId?: string;
  }): Promise<ActiveSessionsResponse> {
    const rows = await this.sessions.findActiveByUserId(args.userId);
    return {
      sessions: rows.map((s) => ({
        id: s.id!,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        deviceLabel: s.deviceLabel,
        lastActivityAt: s.lastActivityAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        isCurrent: s.id === args.currentSessionId,
      })),
    };
  }
}
