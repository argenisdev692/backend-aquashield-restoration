import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MarkAppointmentReadCommand } from '../mark-appointment-read.command';
import { APPOINTMENT_REPOSITORY } from '../../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../../domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from '../../../domain/ports/outbound/audit.port.interface';
import type { IAuditPort } from '../../../domain/ports/outbound/audit.port.interface';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { AppointmentReadEvent } from '../../../domain/events/appointment-read.domain-event';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
@CommandHandler(MarkAppointmentReadCommand)
export class MarkAppointmentReadHandler
  implements ICommandHandler<MarkAppointmentReadCommand>
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
  async execute(command: MarkAppointmentReadCommand): Promise<void> {
    const { id, actorId } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('MarkAppointmentReadHandler start', {
      traceId,
      appointmentId: id,
    });

    const appointment = await this.repo.findById(id);
    if (!appointment) {
      throw new NotFoundException(`Appointment with id ${id} not found`);
    }

    await this.repo.markAsRead(id);

    await this.audit.log(
      {
        action: 'appointments.read',
        actorId,
        resourceId: id,
        traceId,
      },
      { strict: true },
    );

    await this.cache.delByPattern(MarkAppointmentReadHandler.CACHE_PATTERN);

    this.eventEmitter.emit('appointment.read', new AppointmentReadEvent(id));

    this.logger.info('MarkAppointmentReadHandler end', {
      traceId,
      appointmentId: id,
    });
  }
}
