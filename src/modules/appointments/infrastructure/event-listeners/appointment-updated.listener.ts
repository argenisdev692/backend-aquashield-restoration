import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppointmentUpdatedEvent } from '../../domain/events/appointment-updated.domain-event';
import { AppointmentsGateway } from '../gateways/appointments.gateway';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AppointmentUpdatedListener {
  constructor(
    private readonly gateway: AppointmentsGateway,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  @OnEvent('appointment.updated')
  handle(event: AppointmentUpdatedEvent): void {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AppointmentUpdatedListener', {
      traceId,
      appointmentId: event.appointmentId,
    });
    this.gateway.broadcastAppointmentUpdated(event.appointmentId);
  }
}
