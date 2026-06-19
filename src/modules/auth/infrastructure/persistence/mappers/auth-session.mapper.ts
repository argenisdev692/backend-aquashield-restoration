import {
  AuthSession,
  type DeviceInfo,
} from '../../../domain/entities/auth-session.entity';
import { RefreshTokenHash } from '../../../domain/value-objects/refresh-token-hash.vo';

export interface AuthSessionRow {
  id: string;
  userId: string;
  refreshToken: string;
  deviceInfo: unknown;
  userAgent: string | null;
  deviceLabel: string | null;
  ipAddress: string | null;
  lastActivityAt: Date;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function toAuthSession(row: AuthSessionRow): AuthSession {
  return AuthSession.reconstitute({
    id: row.id,
    userId: row.userId,
    refreshTokenHash: RefreshTokenHash.unsafeReconstitute(row.refreshToken),
    deviceInfo: normalizeDeviceInfo(row.deviceInfo),
    userAgent: row.userAgent,
    deviceLabel: row.deviceLabel,
    ipAddress: row.ipAddress,
    lastActivityAt: row.lastActivityAt,
    revokedAt: row.revokedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function normalizeDeviceInfo(value: unknown): DeviceInfo | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return null;
  return value as DeviceInfo;
}
