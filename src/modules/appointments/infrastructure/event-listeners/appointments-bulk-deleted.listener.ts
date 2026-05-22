import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { AppointmentsBulkDeletedEvent } from '../../domain/events/appointments-bulk-deleted.domain-event';
import { AppointmentsBulkRestoredEvent } from '../../domain/events/appointments-bulk-restored.domain-event';
import { AppointmentsGateway } from '../gateways/appointments.gateway';

@Injectable()
export class AppointmentsBulkListener {
  constructor(
    private readonly gateway: AppointmentsGateway,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  @OnEvent('appointments.bulk_deleted')
  handleDeleted(event: AppointmentsBulkDeletedEvent): void {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AppointmentsBulkListener.handleDeleted', {
      traceId,
      count: event.ids.length,
    });
    this.gateway.broadcastAppointmentsBulkDeleted(event.ids);
  }

  @OnEvent('appointments.bulk_restored')
  handleRestored(event: AppointmentsBulkRestoredEvent): void {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AppointmentsBulkListener.handleRestored', {
      traceId,
      count: event.ids.length,
    });
    this.gateway.broadcastAppointmentsBulkRestored(event.ids);
  }
}
