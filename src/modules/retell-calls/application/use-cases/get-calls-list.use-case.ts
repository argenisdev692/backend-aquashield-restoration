import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import {
  RETELL_CALL_REPOSITORY,
  type IRetellCallRepository,
  type PaginatedResult,
  type RetellCallReadModel,
} from '../../domain/repositories/retell-call-repository.interface';
import { resolveTrashedMode } from '../../../../shared/crud/trashed.util';
import { resolveDateRange } from '../../../../shared/crud/date-range.util';
import type { CallFiltersInput } from '../dtos/call-filters.dto';

@Injectable()
export class GetCallsListUseCase {
  constructor(
    @Inject(RETELL_CALL_REPOSITORY)
    private readonly repo: IRetellCallRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetCallsListUseCase.name);
  }

  execute(
    filters: CallFiltersInput,
  ): Promise<PaginatedResult<RetellCallReadModel>> {
    this.logger.info('Listing Retell calls', {
      traceId: this.cls.get<string>('traceId'),
      page: filters.page,
      limit: filters.limit,
      status: filters.status,
    });
    const mode = resolveTrashedMode({
      status: filters.status,
      withTrashed: filters.withTrashed,
      onlyTrashed: filters.onlyTrashed,
    });
    const range = resolveDateRange({
      start_date: filters.start_date,
      end_date: filters.end_date,
    });
    return this.repo.paginate(
      {
        page: filters.page,
        limit: filters.limit,
        search: filters.search,
        callStatus: filters.callStatus,
        userSentiment: filters.userSentiment,
      },
      mode,
      range,
    );
  }
}
