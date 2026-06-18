import { Injectable, Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import type { IContactSupportRepository } from '../../domain/ports/contact-support.repository.interface';
import type { PaginatedContactSupport } from '../../domain/read-models/contact-support.read-model';
import type { TrashedMode } from '../../../../shared/crud/trashed.util';
import type { DateRange } from '../../../../shared/crud/date-range.util';

@Injectable()
export class ListContactSupportUseCase {
  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ListContactSupportUseCase.name);
  }

  async execute(filters: {
    page: number;
    limit: number;
    isRead?: boolean;
    trashed: TrashedMode;
    range?: DateRange;
  }): Promise<PaginatedContactSupport> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ListContactSupportUseCase', {
      traceId,
      page: filters.page,
      limit: filters.limit,
      range: filters.range,
    });

    return this.repo.findMany(filters);
  }
}
