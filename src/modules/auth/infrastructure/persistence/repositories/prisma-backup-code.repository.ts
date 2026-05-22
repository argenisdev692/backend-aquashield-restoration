import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type {
  IBackupCodeRepository,
  BackupCodeRow,
} from '../../../domain/repositories/backup-code.repository.interface';

@Injectable()
export class PrismaBackupCodeRepository implements IBackupCodeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PrismaBackupCodeRepository.name);
  }

  async replaceAllForUser(
    userId: string,
    codeHashes: string[],
  ): Promise<void> {
    // Caller is responsible for wrapping this in a tx via runInTx so a
    // partial failure does not leave the user with mixed-generation codes.
    await this.prisma.backupCode.deleteMany({ where: { userId } });
    if (codeHashes.length === 0) return;
    await this.prisma.backupCode.createMany({
      data: codeHashes.map((codeHash) => ({ userId, codeHash })),
    });
  }

  async findUnusedByUserId(userId: string): Promise<BackupCodeRow[]> {
    const rows = await this.prisma.backupCode.findMany({
      where: { userId, usedAt: null },
      select: { id: true, codeHash: true, usedAt: true },
    });
    return rows;
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.backupCode.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.backupCode.deleteMany({ where: { userId } });
  }

  async countUnusedByUserId(userId: string): Promise<number> {
    return this.prisma.backupCode.count({
      where: { userId, usedAt: null },
    });
  }
}
