import { TrustedDevice } from '../entities/trusted-device.entity';

export interface ITrustedDeviceRepository {
  create(device: TrustedDevice): Promise<string>;
  save(device: TrustedDevice): Promise<void>;

  findByTokenHash(hash: string): Promise<TrustedDevice | null>;
  findByUserId(userId: string): Promise<TrustedDevice[]>;

  /** Remove a trusted-device row (user revoked the 30-day cookie). */
  deleteById(id: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}

export const TRUSTED_DEVICE_REPOSITORY = Symbol('ITrustedDeviceRepository');
