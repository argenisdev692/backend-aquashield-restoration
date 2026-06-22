import { Injectable, Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateAppointmentCommand } from '../create-appointment.command';
import {
  APPOINTMENT_REPOSITORY,
  type IAppointmentRepository,
} from '../../../domain/repositories/appointment-repository.interface';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../domain/ports/outbound/audit.port.interface';
import {
  EMAIL_PORT,
  type IEmailPort,
} from '../../../domain/ports/outbound/email.port.interface';
import {
  CACHE_PORT,
  type ICachePort,
} from '../../../../../shared/cache/cache.port';
import { Appointment } from '../../../domain/entities/appointment.aggregate';
import { AppointmentCreatedEvent } from '../../../domain/events/appointment-created.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { escapeHtml } from '../../../../../shared/external/email/email-html.util';
import {
  AppointmentMutationHandler,
  toNullableDate,
} from './appointment-mutation.handler';

@Injectable()
@CommandHandler(CreateAppointmentCommand)
export class CreateAppointmentHandler
  extends AppointmentMutationHandler
  implements ICommandHandler<CreateAppointmentCommand>
{
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) repo: IAppointmentRepository,
    @Inject(AUDIT_PORT) audit: IAuditPort,
    @Inject(CACHE_PORT) cache: ICachePort,
    logger: LoggerService,
    cls: ClsService,
    @Inject(EMAIL_PORT) private readonly emailPort: IEmailPort,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(repo, audit, cache, logger, cls);
  }

  async execute(command: CreateAppointmentCommand): Promise<string> {
    const { dto } = command;
    this.logger.info('CreateAppointmentHandler start', {
      traceId: this.traceId,
    });

    // Pre-check duplicate email OUTSIDE the tx — a P2002 inside the tx
    // aborts it and prevents any further work (audit, side-effects).
    if (dto.email) {
      const existingId = await this.repo.findIdByEmail(dto.email);
      if (existingId) {
        await this.handleDuplicate(
          existingId,
          dto.email,
          dto.firstName,
          command.actorId,
        );
        return existingId;
      }
    }

    const id = await this.persist(command);

    await this.invalidateListCache();

    this.eventEmitter.emit(
      'appointment.created',
      new AppointmentCreatedEvent(id),
    );

    this.logger.info('CreateAppointmentHandler end', {
      traceId: this.traceId,
      appointmentId: id,
    });

    return id;
  }

  @Transactional()
  private async persist(command: CreateAppointmentCommand): Promise<string> {
    const { dto, actorId } = command;

    const appointment = Appointment.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email ?? null,
      address: dto.address,
      address2: dto.address2 ?? null,
      city: dto.city,
      state: dto.state,
      zipcode: dto.zipcode,
      country: dto.country,
      insuranceProperty: dto.insuranceProperty,
      message: dto.message ?? null,
      smsConsent: dto.smsConsent,
      // Registration date is server-owned: stamp "now" on create when the
      // client doesn't supply one (the admin form no longer exposes the field,
      // and the public submission never sends it).
      registrationDate: toNullableDate(dto.registrationDate) ?? new Date(),
      inspectionDate: toNullableDate(dto.inspectionDate),
      inspectionTime: toNullableDate(dto.inspectionTime),
      inspectionStatus: dto.inspectionStatus ?? null,
      statusLead: dto.statusLead ?? null,
      leadSource: dto.leadSource ?? null,
      followUpCalls: dto.followUpCalls ?? null,
      notes: dto.notes ?? null,
      owner: dto.owner ?? null,
      damageDetail: dto.damageDetail ?? null,
      intentToClaim: dto.intentToClaim ?? null,
      followUpDate: toNullableDate(dto.followUpDate),
      additionalNote: dto.additionalNote ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    });

    await this.repo.save(appointment);

    await this.audit.log(
      {
        action: 'appointments.created',
        actorId,
        resourceId: appointment.id.value,
        traceId: this.traceId,
      },
      { strict: true },
    );

    return appointment.id.value;
  }

  /**
   * Silent-success branch when the lead already submitted with this email.
   * Sends a courtesy "we already received your request" mail and audits the
   * event without leaking PII into the audit metadata.
   */
  private async handleDuplicate(
    existingId: string,
    email: string,
    firstName: string,
    actorId: string | undefined,
  ): Promise<void> {
    this.logger.warn('Duplicate appointment email — silent success', {
      traceId: this.traceId,
      appointmentId: existingId,
    });

    await this.emailPort.sendEmail({
      to: email,
      subject: 'We already received your request',
      html:
        '<h1>Thank you for your interest!</h1>' +
        `<p>Hi ${escapeHtml(firstName)},</p>` +
        '<p>We have already received your appointment request. ' +
        'Our team will contact you shortly to discuss your needs.</p>' +
        "<p>No need to submit again — we've got you covered.</p>",
    });

    await this.audit.log(
      {
        action: 'appointments.duplicate_email_prevented',
        actorId,
        resourceId: existingId,
        traceId: this.traceId,
      },
      { strict: false },
    );
  }
}
