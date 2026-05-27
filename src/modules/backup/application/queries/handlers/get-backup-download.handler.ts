import type { Readable } from 'node:stream';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IBackupRepository } from '../../../domain/ports/backup.repository.interface';
import { BACKUP_REPOSITORY } from '../../../domain/ports/backup.repository.interface';
import type { IBackupStoragePort } from '../../../domain/ports/backup-storage.port';
import { BACKUP_STORAGE_PORT } from '../../../domain/ports/backup-storage.port';
import {
  BackupNotDownloadableException,
  BackupNotFoundException,
} from '../../../domain/exceptions/backup-domain.exception';
import { GetBackupDownloadQuery } from '../get-backup-download.query';

export interface BackupDownload {
  body: Readable;
  contentLength: number;
  filename: string;
}

@QueryHandler(GetBackupDownloadQuery)
export class GetBackupDownloadHandler implements IQueryHandler<GetBackupDownloadQuery> {
  constructor(
    @Inject(BACKUP_REPOSITORY) private readonly repo: IBackupRepository,
    @Inject(BACKUP_STORAGE_PORT) private readonly storage: IBackupStoragePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetBackupDownloadHandler.name);
  }

  async execute(query: GetBackupDownloadQuery): Promise<BackupDownload> {
    this.logger.info('GetBackupDownloadHandler', {
      traceId: this.cls.get<string>('traceId'),
      backupId: query.backupId,
    });
    const backup = await this.repo.findById(query.backupId);
    if (!backup) throw new BackupNotFoundException(query.backupId);
    if (!backup.isDownloadable() || backup.objectKey === null) {
      throw new BackupNotDownloadableException(query.backupId, backup.status);
    }
    const { body, contentLength } = await this.storage.download(
      backup.objectKey,
    );
    return {
      body,
      contentLength,
      filename: `backup-${backup.id.value}-${backup.createdAt.toISOString()}.dump`,
    };
  }
}
