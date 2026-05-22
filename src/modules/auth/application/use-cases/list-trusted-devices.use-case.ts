import { Inject, Injectable } from '@nestjs/common';
import type { ITrustedDeviceRepository } from '../../domain/repositories/trusted-device.repository.interface';
import { TRUSTED_DEVICE_REPOSITORY } from '../../domain/repositories/trusted-device.repository.interface';

export interface TrustedDeviceDto {
  id: string;
  label: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastUsedAt: string;
  createdAt: string;
  expiresAt: string;
}

@Injectable()
export class ListTrustedDevicesUseCase {
  constructor(
    @Inject(TRUSTED_DEVICE_REPOSITORY)
    private readonly repo: ITrustedDeviceRepository,
  ) {}

  async execute(userId: string): Promise<TrustedDeviceDto[]> {
    const rows = await this.repo.listForUser(userId);
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      lastUsedAt: r.lastUsedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
    }));
  }
}
