import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeleteAppointmentCommand } from '../delete-appointment.command';
import { APPOINTMENT_REPOSITORY } from '../../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../../domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from '../../../domain/ports/outbound/audit.port.interface';
import type { IAuditPort } from '../../../domain/ports/outbound/audit.port.interface';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { AppointmentDeletedEvent } from '../../../domain/events/appointment-deleted.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
@CommandHandler(DeleteAppointmentCommand)
export class DeleteAppointmentHandler
  implements ICommandHandler<DeleteAppointmentCommand>
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
  async execute(command: DeleteAppointmentCommand): Promise<void> {
    const { id, actorId } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('DeleteAppointmentHandler start', {
      traceId,
      appointmentId: id,
    });

    const appointment = await this.repo.findById(id);
    if (!appointment) {
      throw new NotFoundException(`Appointment with id ${id} not found`);
    }

    await this.repo.delete(id);

    await this.audit.log(
      {
        action: 'appointments.deleted',
        actorId,
        resourceId: id,
        traceId,
      },
      { strict: true },
    );

    await this.cache.delByPattern(DeleteAppointmentHandler.CACHE_PATTERN);

    this.eventEmitter.emit(
      'appointment.deleted',
      new AppointmentDeletedEvent(id),
    );

    this.logger.info('DeleteAppointmentHandler end', {
      traceId,
      appointmentId: id,
    });
  }
}
