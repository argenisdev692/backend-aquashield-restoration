import { Injectable, Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BulkRestoreAppointmentsCommand } from '../bulk-restore-appointments.command';
import { APPOINTMENT_REPOSITORY } from '../../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../../domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from '../../../domain/ports/outbound/audit.port.interface';
import type { IAuditPort } from '../../../domain/ports/outbound/audit.port.interface';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { AppointmentsBulkRestoredEvent } from '../../../domain/events/appointments-bulk-restored.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
@CommandHandler(BulkRestoreAppointmentsCommand)
export class BulkRestoreAppointmentsHandler
  implements ICommandHandler<BulkRestoreAppointmentsCommand>
{
  private static readonly CACHE_PATTERN = 'http:*:/appointments*';

  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Transactional()
  async execute(
    command: BulkRestoreAppointmentsCommand,
  ): Promise<{ count: number }> {
    const { ids, actorId } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BulkRestoreAppointmentsHandler start', {
      traceId,
      ids,
    });

    const result = await this.repo.bulkRestore(ids);

    await this.audit.log(
      {
        action: 'appointments.bulk_restored',
        actorId,
        metadata: { ids, count: result.count },
        traceId,
      },
      { strict: true },
    );

    await this.cache.delByPattern(BulkRestoreAppointmentsHandler.CACHE_PATTERN);

    this.eventEmitter.emit(
      'appointments.bulk_restored',
      new AppointmentsBulkRestoredEvent(ids),
    );

    this.logger.info('BulkRestoreAppointmentsHandler end', {
      traceId,
      count: result.count,
    });

    return result;
  }
}
