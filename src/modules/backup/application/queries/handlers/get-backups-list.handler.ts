import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import type {
  IBackupRepository,
  PaginatedBackups,
} from '../../../domain/ports/backup.repository.interface';
import { BACKUP_REPOSITORY } from '../../../domain/ports/backup.repository.interface';
import { GetBackupsListQuery } from '../get-backups-list.query';

@QueryHandler(GetBackupsListQuery)
export class GetBackupsListHandler implements IQueryHandler<GetBackupsListQuery> {
  constructor(
    @Inject(BACKUP_REPOSITORY) private readonly repo: IBackupRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetBackupsListHandler.name);
  }

  async execute(query: GetBackupsListQuery): Promise<PaginatedBackups> {
    this.logger.info('GetBackupsListHandler', {
      traceId: this.cls.get<string>('traceId'),
      page: query.page,
      limit: query.limit,
    });
    return this.repo.findAll({ page: query.page, limit: query.limit });
  }
}
