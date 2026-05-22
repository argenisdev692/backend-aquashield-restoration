import { Injectable, Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BulkDeleteAppointmentsCommand } from '../bulk-delete-appointments.command';
import { APPOINTMENT_REPOSITORY } from '../../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../../domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from '../../../domain/ports/outbound/audit.port.interface';
import type { IAuditPort } from '../../../domain/ports/outbound/audit.port.interface';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { AppointmentsBulkDeletedEvent } from '../../../domain/events/appointments-bulk-deleted.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
@CommandHandler(BulkDeleteAppointmentsCommand)
export class BulkDeleteAppointmentsHandler
  implements ICommandHandler<BulkDeleteAppointmentsCommand>
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
  ) {
    this.logger.setContext(BulkDeleteAppointmentsHandler.name);
  }

  async execute(
    command: BulkDeleteAppointmentsCommand,
  ): Promise<{ count: number }> {
    const { ids } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BulkDeleteAppointmentsHandler start', {
      traceId,
      ids,
    });

    const result = await this.persist(command);

    await this.cache.delByPattern(BulkDeleteAppointmentsHandler.CACHE_PATTERN);
    this.eventEmitter.emit(
      'appointments.bulk_deleted',
      new AppointmentsBulkDeletedEvent(ids),
    );

    this.logger.info('BulkDeleteAppointmentsHandler end', {
      traceId,
      count: result.count,
    });

    return result;
  }

  @Transactional()
  private async persist(
    command: BulkDeleteAppointmentsCommand,
  ): Promise<{ count: number }> {
    const { ids, actorId } = command;
    const traceId = this.cls.get<string>('traceId');

    const result = await this.repo.bulkDelete(ids);

    await this.audit.log(
      {
        action: 'appointments.bulk_deleted',
        actorId,
        metadata: { ids, count: result.count },
        traceId,
      },
      { strict: true },
    );

    return result;
  }
}
