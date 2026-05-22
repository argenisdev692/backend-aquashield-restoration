import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetAppointmentByIdQuery } from '../get-appointment-by-id.query';
import { APPOINTMENT_REPOSITORY } from '../../../domain/repositories/appointment-repository.interface';
import type {
  IAppointmentRepository,
  AppointmentReadModel,
} from '../../../domain/repositories/appointment-repository.interface';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
@QueryHandler(GetAppointmentByIdQuery)
export class GetAppointmentByIdHandler
  implements IQueryHandler<GetAppointmentByIdQuery>
{
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(GetAppointmentByIdHandler.name);
  }

  async execute(query: GetAppointmentByIdQuery): Promise<AppointmentReadModel> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetAppointmentByIdHandler', {
      traceId,
      appointmentId: query.id,
      withTrashed: query.withTrashed,
    });
    const appointment = await this.repo.findReadModelById(
      query.id,
      query.withTrashed,
    );
    if (!appointment) {
      throw new NotFoundException(`Appointment ${query.id} not found`);
    }
    return appointment;
  }
}
