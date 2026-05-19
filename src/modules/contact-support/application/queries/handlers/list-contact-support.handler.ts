import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import { ListContactSupportQuery } from '../impl/list-contact-support.query';
import { CONTACT_SUPPORT_REPOSITORY } from '../../../domain/ports/contact-support.repository.interface';
import type { IContactSupportRepository } from '../../../domain/ports/contact-support.repository.interface';
import type { PaginatedContactSupport } from '../../../domain/read-models/contact-support.read-model';

@QueryHandler(ListContactSupportQuery)
export class ListContactSupportHandler implements IQueryHandler<ListContactSupportQuery> {
  constructor(
    @Inject(CONTACT_SUPPORT_REPOSITORY)
    private readonly repo: IContactSupportRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(ListContactSupportHandler.name);
  }

  async execute(
    query: ListContactSupportQuery,
  ): Promise<PaginatedContactSupport> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ListContactSupportHandler', {
      traceId,
      page: query.page,
      limit: query.limit,
    });

    return this.repo.findMany({
      page: query.page,
      limit: query.limit,
      readed: query.readed,
    });
  }
}
