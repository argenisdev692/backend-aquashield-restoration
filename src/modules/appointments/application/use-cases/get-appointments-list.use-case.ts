import { Injectable, Inject } from '@nestjs/common';
import type { AppointmentFiltersInput } from '../dtos/appointment-filters.dto';
import { APPOINTMENT_REPOSITORY } from '../../domain/repositories/appointment-repository.interface';
import type {
  IAppointmentRepository,
  AppointmentFilters,
  AppointmentReadModel,
  PaginatedResult,
} from '../../domain/repositories/appointment-repository.interface';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class GetAppointmentsListUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(
    dto: AppointmentFiltersInput,
  ): Promise<PaginatedResult<AppointmentReadModel>> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetAppointmentsListUseCase', { traceId });

    const filters: AppointmentFilters = {
      statusLead: dto.statusLead,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      owner: dto.owner,
      page: dto.page,
      limit: dto.limit,
    };

    return this.repo.findAll(filters);
  }
}
