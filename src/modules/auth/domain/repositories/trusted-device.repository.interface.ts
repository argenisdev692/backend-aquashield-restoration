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

export interface CreateTrustedDeviceData {
  userId: string;
  deviceTokenHash: string;
  label: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
}

export interface ITrustedDeviceRepository {
  save(data: CreateTrustedDeviceData): Promise<TrustedDeviceRow>;
  /** Returns the row only when it belongs to the user AND is still valid. */
  findValidForUser(
    userId: string,
    deviceTokenHash: string,
  ): Promise<TrustedDeviceRow | null>;
  touch(id: string): Promise<void>;
  listForUser(userId: string): Promise<TrustedDeviceRow[]>;
  deleteByIdForUser(id: string, userId: string): Promise<boolean>;
  deleteAllForUser(userId: string): Promise<void>;
  /** GC helper — caller may run this from a cron. */
  deleteExpired(): Promise<number>;
}

export const TRUSTED_DEVICE_REPOSITORY = Symbol('ITrustedDeviceRepository');
