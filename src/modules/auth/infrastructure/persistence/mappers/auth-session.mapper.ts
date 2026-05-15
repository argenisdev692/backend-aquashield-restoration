import type { Prisma } from '../../../../../generated/prisma/client';
import { AuthSession } from '../../../domain/entities/auth-session.aggregate';
import type { DeviceInfo } from '../../../domain/entities/auth-session.aggregate';

type SessionRow = Prisma.AuthSessionGetPayload<Record<string, never>>;

export class AuthSessionMapper {
  static toDomain(row: SessionRow): AuthSession {
    return AuthSession.reconstitute({
      id: row.id,
      userId: row.userId,
      refreshToken: row.refreshToken,
      deviceInfo: row.deviceInfo as DeviceInfo | null,
      ipAddress: row.ipAddress,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
    });
  }

  static toPersistence(
    session: AuthSession,
  ): Prisma.AuthSessionUncheckedCreateInput {
    return {
      userId: session.userId,
      refreshToken: session.refreshToken.value,
      deviceInfo: session.deviceInfo as Prisma.InputJsonValue | undefined,
      ipAddress: session.ipAddress,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }
}
