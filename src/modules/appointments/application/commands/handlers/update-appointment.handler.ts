import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UpdateAppointmentCommand } from '../update-appointment.command';
import { APPOINTMENT_REPOSITORY } from '../../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../../domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from '../../../domain/ports/outbound/audit.port.interface';
import type { IAuditPort } from '../../../domain/ports/outbound/audit.port.interface';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { AppointmentUpdatedEvent } from '../../../domain/events/appointment-updated.domain-event';
import { StatusChangedEvent } from '../../../domain/events/status-changed.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

type StatusChange = { oldStatus: string | null; newStatus: string };

@Injectable()
@CommandHandler(UpdateAppointmentCommand)
export class UpdateAppointmentHandler implements ICommandHandler<UpdateAppointmentCommand> {
  private static readonly CACHE_PATTERN = 'http:*:/appointments*';

  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext(UpdateAppointmentHandler.name);
  }

  async execute(command: UpdateAppointmentCommand): Promise<void> {
    const { id } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('UpdateAppointmentHandler start', {
      traceId,
      appointmentId: id,
    });

    const statusChange = await this.persist(command);

    // Side-effects MUST live outside the tx — Postgres cannot un-send a
    // websocket emit and cache invalidation must only run on commit.
    await this.cache.delByPattern(UpdateAppointmentHandler.CACHE_PATTERN);

    this.eventEmitter.emit(
      'appointment.updated',
      new AppointmentUpdatedEvent(id),
    );
    if (statusChange) {
      this.eventEmitter.emit(
        'appointment.status_changed',
        new StatusChangedEvent(
          id,
          statusChange.oldStatus,
          statusChange.newStatus,
        ),
      );
    }

    this.logger.info('UpdateAppointmentHandler end', {
      traceId,
      appointmentId: id,
    });
  }

  @Transactional()
  private async persist(
    command: UpdateAppointmentCommand,
  ): Promise<StatusChange | null> {
    const { id, dto, actorId } = command;
    const traceId = this.cls.get<string>('traceId');

    const appointment = await this.repo.findById(id);
    if (!appointment) {
      throw new NotFoundException(`Appointment with id ${id} not found`);
    }

    const { statusLead, registrationDate, ...otherProps } = dto;
    let statusChange: StatusChange | null = null;
    if (statusLead) {
      statusChange = appointment.updateStatus(statusLead);
    }
    appointment.updateDetails({
      ...otherProps,
      registrationDate: registrationDate ? new Date(registrationDate) : null,
    });

    await this.repo.save(appointment);

    await this.audit.log(
      {
        action: 'appointments.updated',
        actorId,
        resourceId: id,
        traceId,
      },
      { strict: true },
    );

    return statusChange;
  }
}
