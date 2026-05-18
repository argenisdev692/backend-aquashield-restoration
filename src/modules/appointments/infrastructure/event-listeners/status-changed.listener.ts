import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { StatusChangedEvent } from '../../domain/events/status-changed.domain-event';
import { AppointmentsGateway } from '../gateways/appointments.gateway';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class StatusChangedListener {
  constructor(
    private readonly gateway: AppointmentsGateway,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  @OnEvent('appointment.status_changed')
  handle(event: StatusChangedEvent): void {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('StatusChangedListener', {
      traceId,
      appointmentId: event.appointmentId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
    });
    this.gateway.broadcastStatusChanged(
      event.appointmentId,
      event.oldStatus,
      event.newStatus,
    );
  }
}
