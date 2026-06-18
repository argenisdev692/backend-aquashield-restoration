import { Injectable, Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RestoreAppointmentCommand } from '../restore-appointment.command';
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
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { AppointmentMutationHandler } from './appointment-mutation.handler';

@Injectable()
@CommandHandler(RestoreAppointmentCommand)
export class RestoreAppointmentHandler
  extends AppointmentMutationHandler
  implements ICommandHandler<RestoreAppointmentCommand>
{
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) repo: IAppointmentRepository,
    @Inject(AUDIT_PORT) audit: IAuditPort,
    @Inject(CACHE_PORT) cache: ICachePort,
    logger: LoggerService,
    cls: ClsService,
  ) {
    super(repo, audit, cache, logger, cls);
  }

  async execute(command: RestoreAppointmentCommand): Promise<void> {
    const { id } = command;
    this.logger.info('RestoreAppointmentHandler start', {
      traceId: this.traceId,
      appointmentId: id,
    });

    await this.persist(command);

    await this.invalidateListCache();

    this.logger.info('RestoreAppointmentHandler end', {
      traceId: this.traceId,
      appointmentId: id,
    });
  }

  @Transactional()
  private async persist(command: RestoreAppointmentCommand): Promise<void> {
    const { id, actorId } = command;

    // `trashed=true` so a soft-deleted row is visible to restore.
    await this.findOrFail(id, true);
    await this.repo.restore(id);

    await this.audit.log(
      {
        action: 'appointments.restored',
        actorId,
        resourceId: id,
        traceId: this.traceId,
      },
      { strict: true },
    );
  }
}
