import { Injectable } from '@nestjs/common';
import type {
  AppointmentEmailData,
  IEmailPort,
} from '../../domain/ports/outbound/email.port.interface';
import { LoggerService } from '../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

/**
 * No-op transport — structured log only, never dumps the rendered body
 * (lead PII). Kept as a dev/offline fallback; production binds the Resend
 * adapter via EMAIL_PORT.
 */
@Injectable()
export class ConsoleEmailAdapter implements IEmailPort {
  constructor(
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  sendEmail(params: { to: string; subject: string }): Promise<void> {
    this.logger.info('ConsoleEmailAdapter.sendEmail', {
      traceId: this.cls.get<string>('traceId'),
      to: params.to,
      subject: params.subject,
    });
    return Promise.resolve();
  }

  notifyAdminsNewLead(params: {
    adminEmails: string[];
    appointmentId: string;
  }): Promise<void> {
    this.logger.info('ConsoleEmailAdapter.notifyAdminsNewLead', {
      traceId: this.cls.get<string>('traceId'),
      appointmentId: params.appointmentId,
      recipients: params.adminEmails.length,
    });
    return Promise.resolve();
  }

  sendSubmissionConfirmation(params: { toEmail: string }): Promise<void> {
    this.logger.info('ConsoleEmailAdapter.sendSubmissionConfirmation', {
      traceId: this.cls.get<string>('traceId'),
      to: params.toEmail,
    });
    return Promise.resolve();
  }

  sendAppointmentConfirmed(params: {
    appointment: AppointmentEmailData;
  }): Promise<void> {
    return this.logLifecycle(
      'sendAppointmentConfirmed',
      params.appointment.appointmentId,
    );
  }

  sendAppointmentRescheduled(params: {
    appointment: AppointmentEmailData;
  }): Promise<void> {
    return this.logLifecycle(
      'sendAppointmentRescheduled',
      params.appointment.appointmentId,
    );
  }

  sendAppointmentCancelled(params: {
    appointment: AppointmentEmailData;
  }): Promise<void> {
    return this.logLifecycle(
      'sendAppointmentCancelled',
      params.appointment.appointmentId,
    );
  }

  notifyAdminsAppointmentScheduled(params: {
    appointment: AppointmentEmailData;
  }): Promise<void> {
    return this.logLifecycle(
      'notifyAdminsAppointmentScheduled',
      params.appointment.appointmentId,
    );
  }

  notifyAdminsAppointmentRescheduled(params: {
    appointment: AppointmentEmailData;
  }): Promise<void> {
    return this.logLifecycle(
      'notifyAdminsAppointmentRescheduled',
      params.appointment.appointmentId,
    );
  }

  notifyAdminsAppointmentCancelled(params: {
    appointment: AppointmentEmailData;
  }): Promise<void> {
    return this.logLifecycle(
      'notifyAdminsAppointmentCancelled',
      params.appointment.appointmentId,
    );
  }

  private logLifecycle(op: string, appointmentId: string): Promise<void> {
    this.logger.info(`ConsoleEmailAdapter.${op}`, {
      traceId: this.cls.get<string>('traceId'),
      appointmentId,
    });
    return Promise.resolve();
  }
}
