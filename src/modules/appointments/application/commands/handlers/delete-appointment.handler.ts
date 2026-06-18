import { Injectable, Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeleteAppointmentCommand } from '../delete-appointment.command';
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
import { AppointmentDeletedEvent } from '../../../domain/events/appointment-deleted.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { AppointmentMutationHandler } from './appointment-mutation.handler';

@Injectable()
@CommandHandler(DeleteAppointmentCommand)
export class DeleteAppointmentHandler
  extends AppointmentMutationHandler
  implements ICommandHandler<DeleteAppointmentCommand>
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

  async execute(command: DeleteAppointmentCommand): Promise<void> {
    const { id } = command;
    this.logger.info('DeleteAppointmentHandler start', {
      traceId: this.traceId,
      appointmentId: id,
    });

    await this.persist(command);

    await this.invalidateListCache();
    this.eventEmitter.emit(
      'appointment.deleted',
      new AppointmentDeletedEvent(id),
    );

    this.logger.info('DeleteAppointmentHandler end', {
      traceId: this.traceId,
      appointmentId: id,
    });
  }

  @Transactional()
  private async persist(command: DeleteAppointmentCommand): Promise<void> {
    const { id, actorId } = command;

    await this.findOrFail(id);
    await this.repo.delete(id);

    await this.audit.log(
      {
        action: 'appointments.deleted',
        actorId,
        resourceId: id,
        traceId: this.traceId,
      },
      { strict: true },
    );
  }
}
