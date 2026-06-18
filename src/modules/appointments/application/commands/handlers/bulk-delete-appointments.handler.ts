import { Injectable, Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BulkDeleteAppointmentsCommand } from '../bulk-delete-appointments.command';
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
import { AppointmentsBulkDeletedEvent } from '../../../domain/events/appointments-bulk-deleted.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { AppointmentMutationHandler } from './appointment-mutation.handler';

@Injectable()
@CommandHandler(BulkDeleteAppointmentsCommand)
export class BulkDeleteAppointmentsHandler
  extends AppointmentMutationHandler
  implements ICommandHandler<BulkDeleteAppointmentsCommand>
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

  async execute(
    command: BulkDeleteAppointmentsCommand,
  ): Promise<{ count: number }> {
    const { ids } = command;
    this.logger.info('BulkDeleteAppointmentsHandler start', {
      traceId: this.traceId,
      ids,
    });

    const result = await this.persist(command);

    await this.invalidateListCache();
    this.eventEmitter.emit(
      'appointments.bulk_deleted',
      new AppointmentsBulkDeletedEvent(ids),
    );

    this.logger.info('BulkDeleteAppointmentsHandler end', {
      traceId: this.traceId,
      count: result.count,
    });

    return result;
  }

  @Transactional()
  private async persist(
    command: BulkDeleteAppointmentsCommand,
  ): Promise<{ count: number }> {
    const { ids, actorId } = command;

    const result = await this.repo.bulkDelete(ids);

    await this.audit.log(
      {
        action: 'appointments.bulk_deleted',
        actorId,
        metadata: { ids, count: result.count },
        traceId: this.traceId,
      },
      { strict: true },
    );

    return result;
  }
}
