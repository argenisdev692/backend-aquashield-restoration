import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type { Backup } from '../../../domain/entities/backup.aggregate';
import type {
  BackupListFilters,
  IBackupRepository,
  PaginatedBackups,
} from '../../../domain/ports/backup.repository.interface';
import type { BackupReadModel } from '../../../domain/read-models/backup.read-model';
import { DatabaseBackupStatus } from '../../../../../generated/prisma/client';
import { BackupMapper } from '../mappers/backup.mapper';

@Injectable()
export class PrismaBackupRepository implements IBackupRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PrismaBackupRepository.name);
  }

  async create(backup: Backup): Promise<void> {
    await this.prisma.databaseBackup.create({
      data: BackupMapper.toCreate(backup),
    });
  }

  async save(backup: Backup): Promise<void> {
    await this.prisma.databaseBackup.update({
      where: { id: backup.id.value },
      data: BackupMapper.toUpdate(backup),
    });
  }

  async findById(id: string): Promise<Backup | null> {
    const row = await this.prisma.databaseBackup.findUnique({ where: { id } });
    return row ? BackupMapper.toDomain(row) : null;
  }

  async findReadModelById(id: string): Promise<BackupReadModel | null> {
    const row = await this.prisma.databaseBackup.findUnique({ where: { id } });
    return row ? BackupMapper.toReadModel(row) : null;
  }

  async findAll(filters: BackupListFilters): Promise<PaginatedBackups> {
    const take = Math.min(filters.limit, 100);
    const skip = (filters.page - 1) * filters.limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.databaseBackup.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.databaseBackup.count(),
    ]);
    return {
      data: rows.map((r) => BackupMapper.toReadModel(r)),
      total,
      page: filters.page,
      limit: filters.limit,
    };
  }

  async findAllForExport(maxRows: number): Promise<BackupReadModel[]> {
    const rows = await this.prisma.databaseBackup.findMany({
      orderBy: { createdAt: 'desc' },
      take: maxRows,
    });
    return rows.map((r) => BackupMapper.toReadModel(r));
  }

  async findCompletedBeyond(
    keep: number,
  ): Promise<Array<{ id: string; objectKey: string }>> {
    const rows = await this.prisma.databaseBackup.findMany({
      where: {
        status: DatabaseBackupStatus.COMPLETED,
        objectKey: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      skip: keep,
      select: { id: true, objectKey: true },
    });
    return rows
      .filter(
        (r): r is { id: string; objectKey: string } => r.objectKey !== null,
      )
      .map((r) => ({ id: r.id, objectKey: r.objectKey }));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.databaseBackup.delete({ where: { id } });
  }
}
