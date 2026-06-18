import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppointmentCreatedEvent } from '../../domain/events/appointment-created.domain-event';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port.interface';
import type { IEmailPort } from '../../domain/ports/outbound/email.port.interface';
import { ADMIN_RECIPIENTS_PORT } from '../../domain/ports/outbound/admin-recipients.port.interface';
import type { IAdminRecipientsPort } from '../../domain/ports/outbound/admin-recipients.port.interface';
import { APPOINTMENT_REPOSITORY } from '../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../domain/repositories/appointment-repository.interface';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { toAppointmentEmailData } from './appointment-email-data.mapper';

@Injectable()
export class AppointmentCreatedEmailListener {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(EMAIL_PORT) private readonly email: IEmailPort,
    @Inject(ADMIN_RECIPIENTS_PORT)
    private readonly adminRecipients: IAdminRecipientsPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(AppointmentCreatedEmailListener.name);
  }

  @OnEvent('appointment.created')
  async handle(event: AppointmentCreatedEvent): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AppointmentCreatedEmailListener', {
      traceId,
      appointmentId: event.appointmentId,
    });

    const appointment = await this.repo.findById(event.appointmentId);
    if (!appointment) {
      this.logger.warn('Appointment not found for email notification', {
        traceId,
        appointmentId: event.appointmentId,
      });
      return;
    }
    const plain = appointment.toPlain();

    try {
      const adminEmails = await this.adminRecipients.getAdminRecipientEmails();
      await this.email.notifyAdminsNewLead({
        adminEmails,
        appointmentId: event.appointmentId,
        firstName: plain.firstName,
        lastName: plain.lastName,
        phone: plain.phone,
        email: plain.email,
        message: plain.message,
      });
    } catch (err) {
      this.logger.error('Failed to send admin lead notification', {
        traceId,
        appointmentId: event.appointmentId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    if (plain.email) {
      try {
        await this.email.sendSubmissionConfirmation({
          toEmail: plain.email,
          toName: plain.firstName,
        });
      } catch (err) {
        this.logger.error('Failed to send submission confirmation', {
          traceId,
          appointmentId: event.appointmentId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // When the lead is created with an inspection already scheduled, alert the
    // admins with the blade-style "New Appointment Confirmed" notice on top of
    // the generic new-lead mail above.
    if (plain.inspectionDate) {
      try {
        const adminEmails =
          await this.adminRecipients.getAdminRecipientEmails();
        await this.email.notifyAdminsAppointmentScheduled({
          adminEmails,
          appointment: toAppointmentEmailData(appointment),
        });
      } catch (err) {
        this.logger.error('Failed to send scheduled admin notification', {
          traceId,
          appointmentId: event.appointmentId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  }
}
