import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type {
  ITrustedDeviceRepository,
  TrustedDeviceRow,
  CreateTrustedDeviceData,
} from '../../../domain/repositories/trusted-device.repository.interface';

@Injectable()
export class PrismaTrustedDeviceRepository
  implements ITrustedDeviceRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PrismaTrustedDeviceRepository.name);
  }

  async save(data: CreateTrustedDeviceData): Promise<TrustedDeviceRow> {
    return this.prisma.trustedDevice.create({ data });
  }

  async findValidForUser(
    userId: string,
    deviceTokenHash: string,
  ): Promise<TrustedDeviceRow | null> {
    return this.prisma.trustedDevice.findFirst({
      where: {
        userId,
        deviceTokenHash,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async touch(id: string): Promise<void> {
    await this.prisma.trustedDevice.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async listForUser(userId: string): Promise<TrustedDeviceRow[]> {
    return this.prisma.trustedDevice.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async deleteByIdForUser(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.trustedDevice.deleteMany({
      where: { id, userId },
    });
    return result.count > 0;
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.trustedDevice.deleteMany({ where: { userId } });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.trustedDevice.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return result.count;
  }
}
