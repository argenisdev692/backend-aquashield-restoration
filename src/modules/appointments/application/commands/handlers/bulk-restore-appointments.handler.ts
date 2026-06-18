import { Injectable, Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BulkRestoreAppointmentsCommand } from '../bulk-restore-appointments.command';
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
import { AppointmentsBulkRestoredEvent } from '../../../domain/events/appointments-bulk-restored.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';
import { AppointmentMutationHandler } from './appointment-mutation.handler';

@Injectable()
@CommandHandler(BulkRestoreAppointmentsCommand)
export class BulkRestoreAppointmentsHandler
  extends AppointmentMutationHandler
  implements ICommandHandler<BulkRestoreAppointmentsCommand>
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
    command: BulkRestoreAppointmentsCommand,
  ): Promise<{ count: number }> {
    const { ids } = command;
    this.logger.info('BulkRestoreAppointmentsHandler start', {
      traceId: this.traceId,
      ids,
    });

    const result = await this.persist(command);

    await this.invalidateListCache();
    this.eventEmitter.emit(
      'appointments.bulk_restored',
      new AppointmentsBulkRestoredEvent(ids),
    );

    this.logger.info('BulkRestoreAppointmentsHandler end', {
      traceId: this.traceId,
      count: result.count,
    });

    return result;
  }

  @Transactional()
  private async persist(
    command: BulkRestoreAppointmentsCommand,
  ): Promise<{ count: number }> {
    const { ids, actorId } = command;

    const result = await this.repo.bulkRestore(ids);

    await this.audit.log(
      {
        action: 'appointments.bulk_restored',
        actorId,
        metadata: { ids, count: result.count },
        traceId: this.traceId,
      },
      { strict: true },
    );

    return result;
  }
}
