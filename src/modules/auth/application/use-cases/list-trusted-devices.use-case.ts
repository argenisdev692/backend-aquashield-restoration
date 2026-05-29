import { Inject, Injectable } from '@nestjs/common';
import {
  TRUSTED_DEVICE_REPOSITORY,
  type ITrustedDeviceRepository,
} from '../../domain/ports/trusted-device.repository.port';
import type { TrustedDevicesResponse } from '../presenters/session.response';

@Injectable()
export class ListTrustedDevicesUseCase {
  constructor(
    @Inject(TRUSTED_DEVICE_REPOSITORY)
    private readonly devices: ITrustedDeviceRepository,
  ) {}

  async execute(userId: string): Promise<TrustedDevicesResponse> {
    const rows = await this.devices.findByUserId(userId);
    // Filter expired rows at the read layer — the row stays for audit until a
    // background scheduler prunes it, but the UI should never offer to
    // revoke an already-dead device.
    const now = Date.now();
    return {
      devices: rows
        .filter((d) => d.expiresAt.getTime() > now)
        .map((d) => ({
          id: d.id!,
          label: d.label,
          ipAddress: d.ipAddress,
          userAgent: d.userAgent,
          lastUsedAt: d.lastUsedAt.toISOString(),
          expiresAt: d.expiresAt.toISOString(),
          createdAt: d.createdAt.toISOString(),
        })),
    };
  }
}
