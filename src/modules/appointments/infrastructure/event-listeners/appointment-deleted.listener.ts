import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppointmentDeletedEvent } from '../../domain/events/appointment-deleted.domain-event';
import { AppointmentsGateway } from '../gateways/appointments.gateway';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AppointmentDeletedListener {
  constructor(
    private readonly gateway: AppointmentsGateway,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  @OnEvent('appointment.deleted')
  handle(event: AppointmentDeletedEvent): void {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AppointmentDeletedListener', {
      traceId,
      appointmentId: event.appointmentId,
    });
    this.gateway.broadcastAppointmentDeleted(event.appointmentId);
  }
}
