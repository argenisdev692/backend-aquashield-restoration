import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppointmentCreatedEvent } from '../../domain/events/appointment-created.domain-event';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port.interface';
import type { IEmailPort } from '../../domain/ports/outbound/email.port.interface';
import { APPOINTMENT_REPOSITORY } from '../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../domain/repositories/appointment-repository.interface';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AppointmentCreatedEmailListener {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(EMAIL_PORT) private readonly email: IEmailPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  @OnEvent('appointment.created')
  async handle(event: AppointmentCreatedEvent) {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('AppointmentCreatedEmailListener', {
      traceId,
      appointmentId: event.appointmentId,
    });

    try {
      const appointment = await this.repo.findById(event.appointmentId);
      if (!appointment) {
        this.logger.warn('Appointment not found for email notification', {
          traceId,
          appointmentId: event.appointmentId,
        });
        return;
      }

      const plain = appointment.toPlain();
      const esc = (value: string | null): string =>
        (value ?? 'N/A').replace(
          /[&<>"']/g,
          (c) =>
            ({
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#39;',
            })[c] ?? c,
        );

      // Get super admin email from config (in production, this would come from users table)
      const superAdminEmail =
        process.env.SUPER_ADMIN_EMAIL || 'admin@example.com';

      await this.email.sendEmail({
        to: superAdminEmail,
        subject: `New Lead Appointment: ${esc(plain.firstName)} ${esc(plain.lastName)}`,
        html: `
          <h2>New Lead Appointment Created</h2>
          <p><strong>Name:</strong> ${esc(plain.firstName)} ${esc(plain.lastName)}</p>
          <p><strong>Phone:</strong> ${esc(plain.phone)}</p>
          <p><strong>Email:</strong> ${esc(plain.email)}</p>
          <p><strong>Address:</strong> ${esc(plain.address)}, ${esc(plain.city)}, ${esc(plain.state)} ${esc(plain.zipcode)}, ${esc(plain.country)}</p>
          <p><strong>Status:</strong> ${esc(plain.statusLead) || 'New'}</p>
          <p><strong>Message:</strong> ${esc(plain.message)}</p>
          <p><strong>Appointment ID:</strong> ${esc(event.appointmentId)}</p>
        `,
        text: `
          New Lead Appointment Created
          Name: ${plain.firstName} ${plain.lastName}
          Phone: ${plain.phone}
          Email: ${plain.email || 'N/A'}
          Address: ${plain.address}, ${plain.city}, ${plain.state} ${plain.zipcode}, ${plain.country}
          Status: ${plain.statusLead || 'New'}
          Message: ${plain.message || 'N/A'}
          Appointment ID: ${event.appointmentId}
        `,
      });

      this.logger.info('Email sent to super admin', {
        traceId,
        appointmentId: event.appointmentId,
        to: superAdminEmail,
      });
    } catch (error) {
      this.logger.error('Failed to send email to super admin', {
        traceId,
        appointmentId: event.appointmentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
