import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import type { IPasswordHistoryRepository } from '../../../domain/ports/password-history.repository.port';
import { PasswordHistoryEntry } from '../../../domain/entities/password-history.entity';

@Injectable()
export class PrismaPasswordHistoryRepository implements IPasswordHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(entry: PasswordHistoryEntry, limit: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordHistory.create({
        data: {
          userId: entry.userId,
          passwordHash: entry.passwordHash,
          createdAt: entry.createdAt,
        },
      });

      // Keep only the N newest entries. The compound (userId, createdAt DESC)
      // index makes the lookup cheap.
      const survivors = await tx.passwordHistory.findMany({
        where: { userId: entry.userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true },
      });
      if (survivors.length > 0) {
        await tx.passwordHistory.deleteMany({
          where: {
            userId: entry.userId,
            id: { notIn: survivors.map((s) => s.id) },
          },
        });
      }
    });
  }

  async findRecentHashes(userId: string, limit: number): Promise<string[]> {
    const rows = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { passwordHash: true },
    });
    return rows.map((r) => r.passwordHash);
  }
}
