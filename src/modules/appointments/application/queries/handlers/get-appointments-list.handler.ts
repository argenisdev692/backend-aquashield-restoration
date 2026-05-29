import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetAppointmentsListQuery } from '../get-appointments-list.query';
import { APPOINTMENT_REPOSITORY } from '../../../domain/repositories/appointment-repository.interface';
import type {
  IAppointmentRepository,
  AppointmentFilters,
  PaginatedResult,
  AppointmentReadModel,
} from '../../../domain/repositories/appointment-repository.interface';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { resolveTrashedMode } from '../../../../../shared/crud/trashed.util';
import { resolveDateRange } from '../../../../../shared/crud/date-range.util';

@Injectable()
@QueryHandler(GetAppointmentsListQuery)
export class GetAppointmentsListHandler implements IQueryHandler<GetAppointmentsListQuery> {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(
    query: GetAppointmentsListQuery,
  ): Promise<PaginatedResult<AppointmentReadModel>> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetAppointmentsListHandler', { traceId });

    const filters: AppointmentFilters = {
      statusLead: query.dto.statusLead,
      city: query.dto.city,
      state: query.dto.state,
      country: query.dto.country,
      owner: query.dto.owner,
      page: query.dto.page,
      limit: query.dto.limit,
      trashed: resolveTrashedMode({
        withTrashed: query.dto.withTrashed,
        onlyTrashed: query.dto.onlyTrashed,
      }),
      range: query.range,
    };

    return this.repo.findAll(filters);
  }
}
