import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { InspectionCancelledEvent } from '../../domain/events/inspection-cancelled.domain-event';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port.interface';
import type { IEmailPort } from '../../domain/ports/outbound/email.port.interface';
import { ADMIN_RECIPIENTS_PORT } from '../../domain/ports/outbound/admin-recipients.port.interface';
import type { IAdminRecipientsPort } from '../../domain/ports/outbound/admin-recipients.port.interface';
import { APPOINTMENT_REPOSITORY } from '../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../domain/repositories/appointment-repository.interface';
import { LoggerService } from '../../../../logger/logger.service';
import { toAppointmentEmailData } from './appointment-email-data.mapper';

/**
 * On `appointment.inspection_cancelled` (emitted after a soft delete): notify
 * the client (ES "cancelada") and the admins (EN "Cancelled Alert"). Only
 * fires for appointments that had an inspection scheduled — deleting a bare
 * lead must not send a cancellation notice. Fire-and-forget.
 */
@Injectable()
export class AppointmentInspectionCancelledEmailListener {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(EMAIL_PORT) private readonly email: IEmailPort,
    @Inject(ADMIN_RECIPIENTS_PORT)
    private readonly adminRecipients: IAdminRecipientsPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(AppointmentInspectionCancelledEmailListener.name);
  }

  @OnEvent('appointment.inspection_cancelled')
  async handle(event: InspectionCancelledEvent): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    // Row is soft-deleted by now → load withTrashed to read its details.
    const appointment = await this.repo.findById(event.appointmentId, true);
    if (!appointment) {
      this.logger.warn('Appointment not found for cancelled email', {
        traceId,
        appointmentId: event.appointmentId,
      });
      return;
    }
    if (!appointment.inspectionDate) {
      this.logger.info(
        'Deleted lead had no inspection — skipping cancel mail',
        {
          traceId,
          appointmentId: event.appointmentId,
        },
      );
      return;
    }
    const data = toAppointmentEmailData(appointment);

    await this.email.sendAppointmentCancelled({ appointment: data });

    const adminEmails = await this.adminRecipients.getAdminRecipientEmails();
    await this.email.notifyAdminsAppointmentCancelled({
      adminEmails,
      appointment: data,
    });
  }
}
