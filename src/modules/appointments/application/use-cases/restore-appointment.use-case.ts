import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { APPOINTMENT_REPOSITORY } from '../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from '../../domain/ports/outbound/audit.port.interface';
import type { IAuditPort } from '../../domain/ports/outbound/audit.port.interface';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class RestoreAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(id: string, actorId: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RestoreAppointmentUseCase start', {
      traceId,
      appointmentId: id,
    });

    const appointment = await this.repo.findById(id);
    if (!appointment) {
      throw new NotFoundException(`Appointment with id ${id} not found`);
    }

    await this.repo.restore(id);

    await this.audit.log({
      action: 'appointments.restored',
      actorId,
      resourceId: id,
      traceId,
    });

    this.logger.info('RestoreAppointmentUseCase end', {
      traceId,
      appointmentId: id,
    });
  }
}
