import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { UpdateAppointmentInput } from '../dtos/update-appointment.dto';
import { APPOINTMENT_REPOSITORY } from '../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from '../../domain/ports/outbound/audit.port.interface';
import type { IAuditPort } from '../../domain/ports/outbound/audit.port.interface';
import { AppointmentUpdatedEvent } from '../../domain/events/appointment-updated.domain-event';
import { StatusChangedEvent } from '../../domain/events/status-changed.domain-event';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class UpdateAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    id: string,
    dto: UpdateAppointmentInput,
    actorId?: string,
  ): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('UpdateAppointmentUseCase start', {
      traceId,
      appointmentId: id,
    });

    const appointment = await this.repo.findById(id);
    if (!appointment) {
      throw new NotFoundException(`Appointment with id ${id} not found`);
    }

    const { statusLead, ...otherProps } = dto;
    let statusChange: { oldStatus: string | null; newStatus: string } | null =
      null;

    if (statusLead) {
      statusChange = appointment.updateStatus(statusLead);
    }

    appointment.updateDetails(otherProps);

    await this.repo.save(appointment);

    await this.audit.log({
      action: 'appointments.updated',
      actorId,
      resourceId: id,
      traceId,
    });

    this.eventEmitter.emit(
      'appointment.updated',
      new AppointmentUpdatedEvent(id),
    );

    if (statusChange) {
      this.eventEmitter.emit(
        'appointment.status_changed',
        new StatusChangedEvent(
          id,
          statusChange.oldStatus,
          statusChange.newStatus,
        ),
      );
    }

    this.logger.info('UpdateAppointmentUseCase end', {
      traceId,
      appointmentId: id,
    });
  }
}
