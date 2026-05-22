import type { Prisma } from '../../../../../generated/prisma/client';
import { AuthSession } from '../../../domain/entities/auth-session.aggregate';
import type { DeviceInfo } from '../../../domain/entities/auth-session.aggregate';

type SessionRow = Prisma.AuthSessionGetPayload<Record<string, never>>;

/**
 * Persistence column `refresh_token` stores the SHA-256 hex hash of the raw
 * refresh token (never the raw value). The mapper is the only place that
 * crosses the domain ↔ row boundary.
 */
export class AuthSessionMapper {
  static toDomain(row: SessionRow): AuthSession {
    return AuthSession.reconstitute({
      id: row.id,
      userId: row.userId,
      refreshTokenHash: row.refreshToken,
      deviceInfo: row.deviceInfo as DeviceInfo | null,
      userAgent: row.userAgent,
      deviceLabel: row.deviceLabel,
      ipAddress: row.ipAddress,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      lastActivityAt: row.lastActivityAt,
      revokedAt: row.revokedAt,
    });
  }

  static toPersistence(
    session: AuthSession,
  ): Prisma.AuthSessionUncheckedCreateInput {
    return {
      userId: session.userId,
      refreshToken: session.refreshToken.hash,
      deviceInfo: session.deviceInfo as Prisma.InputJsonValue | undefined,
      userAgent: session.userAgent,
      deviceLabel: session.deviceLabel,
      ipAddress: session.ipAddress,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
    };
  }
}
