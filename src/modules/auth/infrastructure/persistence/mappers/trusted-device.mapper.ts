import { TrustedDevice } from '../../../domain/entities/trusted-device.entity';

export interface TrustedDeviceRow {
  id: string;
  userId: string;
  deviceTokenHash: string;
  label: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  lastUsedAt: Date;
  createdAt: Date;
}

export function toTrustedDevice(row: TrustedDeviceRow): TrustedDevice {
  return TrustedDevice.reconstitute({
    id: row.id,
    userId: row.userId,
    deviceTokenHash: row.deviceTokenHash,
    label: row.label,
    userAgent: row.userAgent,
    ipAddress: row.ipAddress,
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
  });
}
