import { Injectable, Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UpdateAppointmentCommand } from '../update-appointment.command';
import {
  APPOINTMENT_REPOSITORY,
  type IAppointmentRepository,
} from '../../../domain/repositories/appointment-repository.interface';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../domain/ports/outbound/audit.port.interface';
import {
  CACHE_PORT,
  type ICachePort,
} from '../../../../../shared/cache/cache.port';
import { AppointmentUpdatedEvent } from '../../../domain/events/appointment-updated.domain-event';
import { StatusChangedEvent } from '../../../domain/events/status-changed.domain-event';
import { InspectionConfirmedEvent } from '../../../domain/events/inspection-confirmed.domain-event';
import { InspectionRescheduledEvent } from '../../../domain/events/inspection-rescheduled.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import {
  AppointmentMutationHandler,
  toNullableDate,
} from './appointment-mutation.handler';

type StatusChange = { oldStatus: string | null; newStatus: string };
type Reschedule = {
  previousInspectionDate: Date | null;
  previousInspectionTime: Date | null;
};
type MutationOutcome = {
  statusChange: StatusChange | null;
  inspectionConfirmed: boolean;
  reschedule: Reschedule | null;
};

/** Epoch ms of a nullable Date, for value comparison. */
function dateMs(value: Date | null): number | null {
  return value ? value.getTime() : null;
}

@Injectable()
@CommandHandler(UpdateAppointmentCommand)
export class UpdateAppointmentHandler
  extends AppointmentMutationHandler
  implements ICommandHandler<UpdateAppointmentCommand>
{
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) repo: IAppointmentRepository,
    @Inject(AUDIT_PORT) audit: IAuditPort,
    @Inject(CACHE_PORT) cache: ICachePort,
    logger: LoggerService,
    cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(repo, audit, cache, logger, cls);
  }

  async execute(command: UpdateAppointmentCommand): Promise<void> {
    const { id } = command;
    this.logger.info('UpdateAppointmentHandler start', {
      traceId: this.traceId,
      appointmentId: id,
    });

    const outcome = await this.persist(command);

    // Side-effects MUST live outside the tx — Postgres cannot un-send a
    // websocket emit and cache invalidation must only run on commit.
    await this.invalidateListCache();

    this.eventEmitter.emit(
      'appointment.updated',
      new AppointmentUpdatedEvent(id),
    );
    if (outcome.statusChange) {
      this.eventEmitter.emit(
        'appointment.status_changed',
        new StatusChangedEvent(
          id,
          outcome.statusChange.oldStatus,
          outcome.statusChange.newStatus,
        ),
      );
    }
    if (outcome.inspectionConfirmed) {
      this.eventEmitter.emit(
        'appointment.inspection_confirmed',
        new InspectionConfirmedEvent(id),
      );
    }
    if (outcome.reschedule) {
      this.eventEmitter.emit(
        'appointment.inspection_rescheduled',
        new InspectionRescheduledEvent(
          id,
          outcome.reschedule.previousInspectionDate,
          outcome.reschedule.previousInspectionTime,
        ),
      );
    }

    this.logger.info('UpdateAppointmentHandler end', {
      traceId: this.traceId,
      appointmentId: id,
    });
  }

  @Transactional()
  private async persist(
    command: UpdateAppointmentCommand,
  ): Promise<MutationOutcome> {
    const { id, dto, actorId } = command;

    const appointment = await this.findOrFail(id);

    // Pre-image captured before mutation so we can diff the inspection
    // lifecycle (confirm / reschedule) after the aggregate is updated.
    const before = {
      inspectionStatus: appointment.inspectionStatus,
      inspectionDate: appointment.inspectionDate,
      inspectionTime: appointment.inspectionTime,
    };

    const {
      statusLead,
      registrationDate,
      inspectionDate,
      inspectionTime,
      followUpDate,
      ...otherProps
    } = dto;
    const statusChange = statusLead
      ? appointment.updateStatus(statusLead)
      : null;

    appointment.updateDetails({
      ...otherProps,
      ...(registrationDate !== undefined && {
        registrationDate: toNullableDate(registrationDate),
      }),
      ...(inspectionDate !== undefined && {
        inspectionDate: toNullableDate(inspectionDate),
      }),
      ...(inspectionTime !== undefined && {
        inspectionTime: toNullableDate(inspectionTime),
      }),
      ...(followUpDate !== undefined && {
        followUpDate: toNullableDate(followUpDate),
      }),
    });

    await this.repo.save(appointment);

    await this.audit.log(
      {
        action: 'appointments.updated',
        actorId,
        resourceId: id,
        traceId: this.traceId,
      },
      { strict: true },
    );

    // CONFIRM: inspectionStatus transitioned into `Confirmed`.
    const inspectionConfirmed =
      before.inspectionStatus !== 'Confirmed' &&
      appointment.inspectionStatus === 'Confirmed';

    // RESCHEDULE: an already-scheduled inspection changed date and/or time.
    // First-time scheduling (no prior date) is the create/confirm path, not
    // a reschedule, so it is excluded.
    const dateOrTimeChanged =
      dateMs(appointment.inspectionDate) !== dateMs(before.inspectionDate) ||
      dateMs(appointment.inspectionTime) !== dateMs(before.inspectionTime);
    const reschedule =
      before.inspectionDate && dateOrTimeChanged
        ? {
            previousInspectionDate: before.inspectionDate,
            previousInspectionTime: before.inspectionTime,
          }
        : null;

    return { statusChange, inspectionConfirmed, reschedule };
  }
}
