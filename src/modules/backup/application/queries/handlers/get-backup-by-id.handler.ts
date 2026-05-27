import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IBackupRepository } from '../../../domain/ports/backup.repository.interface';
import { BACKUP_REPOSITORY } from '../../../domain/ports/backup.repository.interface';
import type { BackupReadModel } from '../../../domain/read-models/backup.read-model';
import { GetBackupByIdQuery } from '../get-backup-by-id.query';

@QueryHandler(GetBackupByIdQuery)
export class GetBackupByIdHandler implements IQueryHandler<GetBackupByIdQuery> {
  constructor(
    @Inject(BACKUP_REPOSITORY) private readonly repo: IBackupRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetBackupByIdHandler.name);
  }

  async execute(query: GetBackupByIdQuery): Promise<BackupReadModel | null> {
    this.logger.info('GetBackupByIdHandler', {
      traceId: this.cls.get<string>('traceId'),
      backupId: query.backupId,
    });
    return this.repo.findReadModelById(query.backupId);
  }
}
