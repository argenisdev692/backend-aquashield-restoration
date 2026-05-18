import { Injectable, Inject } from '@nestjs/common';
import type { AppointmentFiltersInput } from '../dtos/appointment-filters.dto';
import { APPOINTMENT_REPOSITORY } from '../../domain/repositories/appointment-repository.interface';
import type {
  IAppointmentRepository,
  AppointmentFilters,
  AppointmentReadModel,
} from '../../domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from '../../domain/ports/outbound/audit.port.interface';
import type { IAuditPort } from '../../domain/ports/outbound/audit.port.interface';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class ExportAppointmentsUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(
    dto: AppointmentFiltersInput,
    format: 'xlsx' | 'pdf',
    actorId: string,
  ): Promise<AppointmentReadModel[]> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ExportAppointmentsUseCase start', { traceId, format });

    const filters: AppointmentFilters = {
      statusLead: dto.statusLead,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      owner: dto.owner,
    };

    const result = await this.repo.findAll(filters);

    await this.audit.log({
      action: 'appointments.export',
      actorId,
      resourceId: 'bulk',
      traceId,
      metadata: { format, rowCount: result.total },
    });

    this.logger.info('ExportAppointmentsUseCase end', {
      traceId,
      format,
      rowCount: result.total,
    });

    return result.data;
  }
}
