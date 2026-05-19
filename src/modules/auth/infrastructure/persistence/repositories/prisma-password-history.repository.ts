import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IPasswordHistoryRepository } from '../../../domain/repositories/password-history.repository.interface';

@Injectable()
export class PrismaPasswordHistoryRepository implements IPasswordHistoryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PrismaPasswordHistoryRepository.name);
  }

  async addEntry(userId: string, hashedPassword: string): Promise<void> {
    await this.prisma.passwordHistory.create({
      data: { userId, passwordHash: hashedPassword },
    });
  }

  async getRecent(userId: string, limit: number): Promise<string[]> {
    const rows = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { passwordHash: true },
    });
    return rows.map((r) => r.passwordHash);
  }

  async pruneOldest(userId: string, keepCount: number): Promise<void> {
    const rows = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: keepCount,
      select: { id: true },
    });
    if (rows.length === 0) return;
    await this.prisma.passwordHistory.deleteMany({
      where: { id: { in: rows.map((r) => r.id) } },
    });
  }
}
