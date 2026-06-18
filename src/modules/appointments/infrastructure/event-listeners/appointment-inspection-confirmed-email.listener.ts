import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { InspectionConfirmedEvent } from '../../domain/events/inspection-confirmed.domain-event';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port.interface';
import type { IEmailPort } from '../../domain/ports/outbound/email.port.interface';
import { ADMIN_RECIPIENTS_PORT } from '../../domain/ports/outbound/admin-recipients.port.interface';
import type { IAdminRecipientsPort } from '../../domain/ports/outbound/admin-recipients.port.interface';
import { APPOINTMENT_REPOSITORY } from '../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../domain/repositories/appointment-repository.interface';
import { LoggerService } from '../../../../logger/logger.service';
import { toAppointmentEmailData } from './appointment-email-data.mapper';

/**
 * On `appointment.inspection_confirmed`: notify the client (ES "confirmada")
 * and the admins (EN "New Appointment Confirmed"). Fire-and-forget — failures
 * are logged, never thrown.
 */
@Injectable()
export class AppointmentInspectionConfirmedEmailListener {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(EMAIL_PORT) private readonly email: IEmailPort,
    @Inject(ADMIN_RECIPIENTS_PORT)
    private readonly adminRecipients: IAdminRecipientsPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(AppointmentInspectionConfirmedEmailListener.name);
  }

  @OnEvent('appointment.inspection_confirmed')
  async handle(event: InspectionConfirmedEvent): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    const appointment = await this.repo.findById(event.appointmentId);
    if (!appointment) {
      this.logger.warn('Appointment not found for confirmed email', {
        traceId,
        appointmentId: event.appointmentId,
      });
      return;
    }
    const data = toAppointmentEmailData(appointment);

    await this.email.sendAppointmentConfirmed({ appointment: data });

    const adminEmails = await this.adminRecipients.getAdminRecipientEmails();
    await this.email.notifyAdminsAppointmentScheduled({
      adminEmails,
      appointment: data,
    });
  }
}
