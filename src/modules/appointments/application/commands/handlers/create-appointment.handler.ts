import { Injectable, Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateAppointmentCommand } from '../create-appointment.command';
import { APPOINTMENT_REPOSITORY } from '../../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../../domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from '../../../domain/ports/outbound/audit.port.interface';
import type { IAuditPort } from '../../../domain/ports/outbound/audit.port.interface';
import { EMAIL_PORT } from '../../../domain/ports/outbound/email.port.interface';
import type { IEmailPort } from '../../../domain/ports/outbound/email.port.interface';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { Appointment } from '../../../domain/entities/appointment.aggregate';
import { AppointmentCreatedEvent } from '../../../domain/events/appointment-created.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
@CommandHandler(CreateAppointmentCommand)
export class CreateAppointmentHandler
  implements ICommandHandler<CreateAppointmentCommand>
{
  /** Mirrors the CacheTtlInterceptor key scheme `http:{userId}:{originalUrl}`. */
  private static readonly CACHE_PATTERN = 'http:*:/appointments*';

  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(EMAIL_PORT) private readonly emailPort: IEmailPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext(CreateAppointmentHandler.name);
  }

  async execute(command: CreateAppointmentCommand): Promise<string> {
    const { dto, actorId } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CreateAppointmentHandler start', { traceId });

    // Pre-check duplicate email OUTSIDE the tx — a P2002 inside the tx
    // aborts it and prevents any further work (audit, side-effects).
    if (dto.email) {
      const existingId = await this.repo.findIdByEmail(dto.email);
      if (existingId) {
        await this.handleDuplicate(existingId, dto.email, dto.firstName, actorId, traceId);
        return existingId;
      }
    }

    const id = await this.persist(command);

    await this.cache.delByPattern(CreateAppointmentHandler.CACHE_PATTERN);

    this.eventEmitter.emit(
      'appointment.created',
      new AppointmentCreatedEvent(id),
    );

    this.logger.info('CreateAppointmentHandler end', {
      traceId,
      appointmentId: id,
    });

    return id;
  }

  @Transactional()
  private async persist(command: CreateAppointmentCommand): Promise<string> {
    const { dto, actorId } = command;
    const traceId = this.cls.get<string>('traceId');

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
      message: dto.message ?? null,
      smsConsent: dto.smsConsent,
      registrationDate: dto.registrationDate ? new Date(dto.registrationDate) : null,
      statusLead: dto.statusLead ?? null,
      followUpCalls: dto.followUpCalls ?? null,
      notes: dto.notes ?? null,
      owner: dto.owner ?? null,
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
        traceId,
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
    traceId: string | undefined,
  ): Promise<void> {
    this.logger.warn('Duplicate appointment email — silent success', {
      traceId,
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
        '<p>No need to submit again — we\'ve got you covered.</p>',
    });

    await this.audit.log(
      {
        action: 'appointments.duplicate_email_prevented',
        actorId,
        resourceId: existingId,
        traceId,
      },
      { strict: false },
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
