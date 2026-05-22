import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { ExportAppointmentsQuery } from '../export-appointments.query';
import { APPOINTMENT_REPOSITORY } from '../../../domain/repositories/appointment-repository.interface';
import type {
  IAppointmentRepository,
  AppointmentFilters,
  AppointmentReadModel,
} from '../../../domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from '../../../domain/ports/outbound/audit.port.interface';
import type { IAuditPort } from '../../../domain/ports/outbound/audit.port.interface';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { resolveTrashedMode } from '../../../../../shared/crud/trashed.util';

@Injectable()
@QueryHandler(ExportAppointmentsQuery)
export class ExportAppointmentsHandler
  implements IQueryHandler<ExportAppointmentsQuery>
{
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(
    query: ExportAppointmentsQuery,
  ): Promise<AppointmentReadModel[]> {
    const { dto, format, userId } = query;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ExportAppointmentsHandler', {
      traceId,
      format,
      userId,
    });

    const filters: AppointmentFilters = {
      statusLead: dto.statusLead,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      owner: dto.owner,
      trashed: resolveTrashedMode({
        withTrashed: dto.withTrashed,
        onlyTrashed: dto.onlyTrashed,
      }),
    };

    const { data } = await this.repo.findAll(filters);

    await this.audit.log(
      {
        action: 'appointments.export',
        actorId: userId,
        traceId,
        metadata: { format, count: data.length },
      },
      { strict: false },
    );

    return data;
  }
}
