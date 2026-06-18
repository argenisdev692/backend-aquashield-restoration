import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { InspectionRescheduledEvent } from '../../domain/events/inspection-rescheduled.domain-event';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port.interface';
import type { IEmailPort } from '../../domain/ports/outbound/email.port.interface';
import { ADMIN_RECIPIENTS_PORT } from '../../domain/ports/outbound/admin-recipients.port.interface';
import type { IAdminRecipientsPort } from '../../domain/ports/outbound/admin-recipients.port.interface';
import { APPOINTMENT_REPOSITORY } from '../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../domain/repositories/appointment-repository.interface';
import { LoggerService } from '../../../../logger/logger.service';
import { toAppointmentEmailData } from './appointment-email-data.mapper';

/**
 * On `appointment.inspection_rescheduled`: notify the client (ES
 * "reprogramada") and the admins (EN "Rescheduled Alert"), both with the
 * before/after schedule block. Fire-and-forget.
 */
@Injectable()
export class AppointmentInspectionRescheduledEmailListener {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(EMAIL_PORT) private readonly email: IEmailPort,
    @Inject(ADMIN_RECIPIENTS_PORT)
    private readonly adminRecipients: IAdminRecipientsPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(AppointmentInspectionRescheduledEmailListener.name);
  }

  @OnEvent('appointment.inspection_rescheduled')
  async handle(event: InspectionRescheduledEvent): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    const appointment = await this.repo.findById(event.appointmentId);
    if (!appointment) {
      this.logger.warn('Appointment not found for rescheduled email', {
        traceId,
        appointmentId: event.appointmentId,
      });
      return;
    }
    const data = toAppointmentEmailData(appointment);

    await this.email.sendAppointmentRescheduled({
      appointment: data,
      previousInspectionDate: event.previousInspectionDate,
      previousInspectionTime: event.previousInspectionTime,
    });

    const adminEmails = await this.adminRecipients.getAdminRecipientEmails();
    await this.email.notifyAdminsAppointmentRescheduled({
      adminEmails,
      appointment: data,
      previousInspectionDate: event.previousInspectionDate,
      previousInspectionTime: event.previousInspectionTime,
    });
  }
}
