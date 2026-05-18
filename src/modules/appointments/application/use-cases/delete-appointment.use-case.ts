import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { APPOINTMENT_REPOSITORY } from '../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from '../../domain/ports/outbound/audit.port.interface';
import type { IAuditPort } from '../../domain/ports/outbound/audit.port.interface';
import { AppointmentDeletedEvent } from '../../domain/events/appointment-deleted.domain-event';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class DeleteAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(id: string, actorId: string): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('DeleteAppointmentUseCase start', {
      traceId,
      appointmentId: id,
    });

    const appointment = await this.repo.findById(id);
    if (!appointment) {
      throw new NotFoundException(`Appointment with id ${id} not found`);
    }

    await this.repo.delete(id);

    await this.audit.log({
      action: 'appointments.deleted',
      actorId,
      resourceId: id,
      traceId,
    });

    this.eventEmitter.emit(
      'appointment.deleted',
      new AppointmentDeletedEvent(id),
    );

    this.logger.info('DeleteAppointmentUseCase end', {
      traceId,
      appointmentId: id,
    });
  }
}
