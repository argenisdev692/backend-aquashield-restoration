import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppointmentCreatedEvent } from '../../domain/events/appointment-created.domain-event';
import { AppointmentsGateway } from '../gateways/appointments.gateway';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AppointmentCreatedListener {
  constructor(
    private readonly gateway: AppointmentsGateway,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  @OnEvent('appointment.created')
  handle(event: AppointmentCreatedEvent): void {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AppointmentCreatedListener', {
      traceId,
      appointmentId: event.appointmentId,
    });
    this.gateway.broadcastAppointmentCreated(event.appointmentId);
  }
}
