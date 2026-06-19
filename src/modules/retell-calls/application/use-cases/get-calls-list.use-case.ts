import { Inject, Injectable } from '@nestjs/common';
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
  ) {}

  execute(
    filters: CallFiltersInput,
  ): Promise<PaginatedResult<RetellCallReadModel>> {
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
