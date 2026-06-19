import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import type { IBackupCodeRepository } from '../../../domain/ports/backup-code.repository.port';
import { BackupCode } from '../../../domain/entities/backup-code.entity';
import {
  toBackupCode,
  type BackupCodeRow,
} from '../mappers/backup-code.mapper';

@Injectable()
export class PrismaBackupCodeRepository implements IBackupCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async replaceAll(userId: string, codes: BackupCode[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.backupCode.deleteMany({ where: { userId } }),
      this.prisma.backupCode.createMany({
        data: codes.map((c) => ({
          userId,
          codeHash: c.codeHash,
          createdAt: c.createdAt,
        })),
      }),
    ]);
  }

  async deleteAll(userId: string): Promise<void> {
    await this.prisma.backupCode.deleteMany({ where: { userId } });
  }

  async findUnusedByUserId(userId: string): Promise<BackupCode[]> {
    const rows = await this.prisma.backupCode.findMany({
      where: { userId, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => toBackupCode(r));
  }

  async markUsed(id: string, now: Date = new Date()): Promise<void> {
    await this.prisma.backupCode.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: now },
    });
  }
}
