import type {
  DatabaseBackup as DatabaseBackupRow,
  Prisma,
  DatabaseBackupStatus as PrismaBackupStatus,
  DatabaseBackupTrigger as PrismaBackupTrigger,
} from '../../../../../generated/prisma/client';
import { Backup } from '../../../domain/entities/backup.aggregate';
import { BackupId } from '../../../domain/value-objects/backup-id.vo';
import {
  BackupStatus,
  BackupTrigger,
} from '../../../domain/value-objects/backup-status.vo';
import type { BackupReadModel } from '../../../application/read-models/backup.read-model';

/**
 * The ONLY contact point between the Prisma row shape and the rest of the
 * codebase. Owns the BigInt → number coercion and the enum mirroring so
 * Prisma's generated enums never leak into the domain.
 */
export class BackupMapper {
  static toDomain(row: DatabaseBackupRow): Backup {
    return Backup.reconstitute({
      id: BackupId.reconstitute(row.id),
      status: this.statusToDomain(row.status),
      triggeredBy: this.triggerToDomain(row.triggeredBy),
      actorId: row.actorId,
      objectKey: row.objectKey,
      sizeBytes: row.sizeBytes !== null ? Number(row.sizeBytes) : null,
      checksum: row.checksum,
      error: row.error,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
    });
  }

  static toReadModel(row: DatabaseBackupRow): BackupReadModel {
    return {
      id: row.id,
      status: this.statusToDomain(row.status),
      triggeredBy: this.triggerToDomain(row.triggeredBy),
      actorId: row.actorId,
      objectKey: row.objectKey,
      sizeBytes: row.sizeBytes !== null ? Number(row.sizeBytes) : null,
      checksum: row.checksum,
      error: row.error,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
    };
  }

  static toCreate(backup: Backup): Prisma.DatabaseBackupUncheckedCreateInput {
    return {
      id: backup.id.value,
      status: this.statusToPrisma(backup.status),
      triggeredBy: this.triggerToPrisma(backup.triggeredBy),
      actorId: backup.actorId,
      objectKey: backup.objectKey,
      sizeBytes: backup.sizeBytes !== null ? BigInt(backup.sizeBytes) : null,
      checksum: backup.checksum,
      error: backup.error,
      startedAt: backup.startedAt,
      completedAt: backup.completedAt,
    };
  }

  static toUpdate(backup: Backup): Prisma.DatabaseBackupUncheckedUpdateInput {
    return {
      status: this.statusToPrisma(backup.status),
      objectKey: backup.objectKey,
      sizeBytes: backup.sizeBytes !== null ? BigInt(backup.sizeBytes) : null,
      checksum: backup.checksum,
      error: backup.error,
      completedAt: backup.completedAt,
    };
  }

  private static statusToDomain(s: PrismaBackupStatus): BackupStatus {
    return s as unknown as BackupStatus;
  }

  private static statusToPrisma(s: BackupStatus): PrismaBackupStatus {
    return s as unknown as PrismaBackupStatus;
  }

  private static triggerToDomain(t: PrismaBackupTrigger): BackupTrigger {
    return t as unknown as BackupTrigger;
  }

  private static triggerToPrisma(t: BackupTrigger): PrismaBackupTrigger {
    return t as unknown as PrismaBackupTrigger;
  }
}
