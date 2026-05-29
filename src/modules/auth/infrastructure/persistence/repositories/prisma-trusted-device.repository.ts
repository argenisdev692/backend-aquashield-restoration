import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import type { ITrustedDeviceRepository } from '../../../domain/ports/trusted-device.repository.port';
import { TrustedDevice } from '../../../domain/entities/trusted-device.entity';
import {
  toTrustedDevice,
  type TrustedDeviceRow,
} from '../mappers/trusted-device.mapper';

@Injectable()
export class PrismaTrustedDeviceRepository implements ITrustedDeviceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(device: TrustedDevice): Promise<string> {
    const row = await this.prisma.trustedDevice.create({
      data: {
        userId: device.userId,
        deviceTokenHash: device.deviceTokenHash,
        label: device.label,
        userAgent: device.userAgent,
        ipAddress: device.ipAddress,
        expiresAt: device.expiresAt,
        lastUsedAt: device.lastUsedAt,
      },
      select: { id: true },
    });
    return row.id;
  }

  async save(device: TrustedDevice): Promise<void> {
    if (device.id === null) {
      throw new Error('Cannot save() a TrustedDevice without id');
    }
    await this.prisma.trustedDevice.update({
      where: { id: device.id },
      data: { lastUsedAt: device.lastUsedAt },
    });
  }

  async findByTokenHash(hash: string): Promise<TrustedDevice | null> {
    const row = await this.prisma.trustedDevice.findUnique({
      where: { deviceTokenHash: hash },
    });
    return row ? toTrustedDevice(row as TrustedDeviceRow) : null;
  }

  async findByUserId(userId: string): Promise<TrustedDevice[]> {
    const rows = await this.prisma.trustedDevice.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    });
    return rows.map((r) => toTrustedDevice(r as TrustedDeviceRow));
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.trustedDevice.delete({ where: { id } });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.trustedDevice.deleteMany({ where: { userId } });
  }
}
