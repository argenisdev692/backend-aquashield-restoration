import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppointmentReadEvent } from '../../domain/events/appointment-read.domain-event';
import { AppointmentsGateway } from '../gateways/appointments.gateway';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AppointmentReadListener {
  constructor(
    private readonly gateway: AppointmentsGateway,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  @OnEvent('appointment.read')
  handle(event: AppointmentReadEvent): void {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AppointmentReadListener', {
      traceId,
      appointmentId: event.appointmentId,
    });
    this.gateway.broadcastAppointmentRead(event.appointmentId);
  }
}
