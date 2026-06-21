import { Injectable, Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { CONTACT_SUPPORT_REPOSITORY } from '../../domain/ports/contact-support.repository.interface';
import type {
  IContactSupportRepository,
  ListContactSupportFilters,
} from '../../domain/ports/contact-support.repository.interface';
import type { PaginatedContactSupport } from '../../domain/read-models/contact-support.read-model';

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

  async execute(
    filters: ListContactSupportFilters,
  ): Promise<PaginatedContactSupport> {
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
