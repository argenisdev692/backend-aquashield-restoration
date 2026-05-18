import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { CreateAppointmentInput } from '../dtos/create-appointment.dto';
import { APPOINTMENT_REPOSITORY } from '../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from '../../domain/ports/outbound/audit.port.interface';
import type { IAuditPort } from '../../domain/ports/outbound/audit.port.interface';
import { Appointment } from '../../domain/entities/appointment.aggregate';
import { AppointmentCreatedEvent } from '../../domain/events/appointment-created.domain-event';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class CreateAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    dto: CreateAppointmentInput,
    actorId?: string,
  ): Promise<string> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CreateAppointmentUseCase start', {
      traceId,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    const appointment = Appointment.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email ?? null,
      address: dto.address,
      address2: dto.address2 ?? null,
      city: dto.city,
      state: dto.state,
      zipcode: dto.zipcode,
      country: dto.country,
      message: dto.message ?? null,
      smsConsent: dto.smsConsent,
      registrationDate: dto.registrationDate ?? null,
      statusLead: dto.statusLead ?? null,
      followUpCalls: dto.followUpCalls ?? null,
      notes: dto.notes ?? null,
      owner: dto.owner ?? null,
      additionalNote: dto.additionalNote ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    });

    await this.repo.save(appointment);

    await this.audit.log({
      action: 'appointments.created',
      actorId,
      resourceId: appointment.id.value,
      traceId,
    });

    this.eventEmitter.emit(
      'appointment.created',
      new AppointmentCreatedEvent(appointment.id.value),
    );

    this.logger.info('CreateAppointmentUseCase end', {
      traceId,
      appointmentId: appointment.id.value,
    });

    return appointment.id.value;
  }
}
