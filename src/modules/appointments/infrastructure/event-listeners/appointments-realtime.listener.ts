import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import { AppointmentsGateway } from '../gateways/appointments.gateway';
import { AppointmentCreatedEvent } from '../../domain/events/appointment-created.domain-event';
import { AppointmentReadEvent } from '../../domain/events/appointment-read.domain-event';
import { AppointmentUpdatedEvent } from '../../domain/events/appointment-updated.domain-event';
import { AppointmentDeletedEvent } from '../../domain/events/appointment-deleted.domain-event';
import { StatusChangedEvent } from '../../domain/events/status-changed.domain-event';
import { AppointmentsBulkDeletedEvent } from '../../domain/events/appointments-bulk-deleted.domain-event';
import { AppointmentsBulkRestoredEvent } from '../../domain/events/appointments-bulk-restored.domain-event';

/**
 * Single realtime fan-out: every appointment domain event is forwarded to the
 * WebSocket gateway from one place. Replaces the five near-identical
 * single-event listeners — adding a new broadcast is now one `@OnEvent`
 * method, not a new file. (The admin-email side-effect stays in its own
 * listener — different responsibility.)
 */
@Injectable()
export class AppointmentsRealtimeListener {
  constructor(
    private readonly gateway: AppointmentsGateway,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(AppointmentsRealtimeListener.name);
  }

  @OnEvent('appointment.created')
  onCreated(event: AppointmentCreatedEvent): void {
    this.log('created', event.appointmentId);
    this.gateway.broadcastAppointmentCreated(event.appointmentId);
  }

  @OnEvent('appointment.read')
  onRead(event: AppointmentReadEvent): void {
    this.log('read', event.appointmentId);
    this.gateway.broadcastAppointmentRead(event.appointmentId);
  }

  @OnEvent('appointment.updated')
  onUpdated(event: AppointmentUpdatedEvent): void {
    this.log('updated', event.appointmentId);
    this.gateway.broadcastAppointmentUpdated(event.appointmentId);
  }

  @OnEvent('appointment.deleted')
  onDeleted(event: AppointmentDeletedEvent): void {
    this.log('deleted', event.appointmentId);
    this.gateway.broadcastAppointmentDeleted(event.appointmentId);
  }

  @OnEvent('appointment.status_changed')
  onStatusChanged(event: StatusChangedEvent): void {
    this.logger.info('AppointmentsRealtimeListener.status_changed', {
      traceId: this.cls.get<string>('traceId'),
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

  @OnEvent('appointments.bulk_deleted')
  onBulkDeleted(event: AppointmentsBulkDeletedEvent): void {
    this.logger.info('AppointmentsRealtimeListener.bulk_deleted', {
      traceId: this.cls.get<string>('traceId'),
      count: event.ids.length,
    });
    this.gateway.broadcastAppointmentsBulkDeleted(event.ids);
  }

  @OnEvent('appointments.bulk_restored')
  onBulkRestored(event: AppointmentsBulkRestoredEvent): void {
    this.logger.info('AppointmentsRealtimeListener.bulk_restored', {
      traceId: this.cls.get<string>('traceId'),
      count: event.ids.length,
    });
    this.gateway.broadcastAppointmentsBulkRestored(event.ids);
  }

  private log(action: string, appointmentId: string): void {
    this.logger.info(`AppointmentsRealtimeListener.${action}`, {
      traceId: this.cls.get<string>('traceId'),
      appointmentId,
    });
  }
}
