import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IBackupRepository } from '../../../domain/ports/backup.repository.interface';
import { BACKUP_REPOSITORY } from '../../../domain/ports/backup.repository.interface';
import type { BackupReadModel } from '../../read-models/backup.read-model';
import { GetBackupByIdQuery } from '../get-backup-by-id.query';

@QueryHandler(GetBackupByIdQuery)
export class GetBackupByIdHandler
  implements IQueryHandler<GetBackupByIdQuery>
{
  constructor(
    @Inject(BACKUP_REPOSITORY) private readonly repo: IBackupRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetBackupByIdHandler.name);
  }

  async execute(
    query: GetBackupByIdQuery,
  ): Promise<BackupReadModel | null> {
    this.logger.info('GetBackupByIdHandler', {
      traceId: this.cls.get<string>('traceId'),
      backupId: query.backupId,
    });
    const backup = await this.repo.findById(query.backupId);
    if (!backup) return null;
    return {
      id: backup.id.value,
      status: backup.status,
      triggeredBy: backup.triggeredBy,
      actorId: backup.actorId,
      objectKey: backup.objectKey,
      sizeBytes: backup.sizeBytes,
      checksum: backup.checksum,
      error: backup.error,
      startedAt: backup.startedAt,
      completedAt: backup.completedAt,
      createdAt: backup.createdAt,
    };
  }
}
