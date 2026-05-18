import { Injectable, Inject } from '@nestjs/common';
import { APPOINTMENT_REPOSITORY } from '../../domain/repositories/appointment-repository.interface';
import type {
  IAppointmentRepository,
  AppointmentReadModel,
} from '../../domain/repositories/appointment-repository.interface';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class GetAppointmentByIdUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(id: string): Promise<AppointmentReadModel | null> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetAppointmentByIdUseCase', {
      traceId,
      appointmentId: id,
    });
    return this.repo.findReadModelById(id);
  }
}
