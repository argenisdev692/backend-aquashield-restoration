import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RestoreAppointmentCommand } from '../restore-appointment.command';
import { APPOINTMENT_REPOSITORY } from '../../../domain/repositories/appointment-repository.interface';
import type { IAppointmentRepository } from '../../../domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from '../../../domain/ports/outbound/audit.port.interface';
import type { IAuditPort } from '../../../domain/ports/outbound/audit.port.interface';
import { CACHE_PORT } from '../../../../../shared/cache/cache.port';
import type { ICachePort } from '../../../../../shared/cache/cache.port';
import { LoggerService } from '../../../../../logger/logger.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
@CommandHandler(RestoreAppointmentCommand)
export class RestoreAppointmentHandler
  implements ICommandHandler<RestoreAppointmentCommand>
{
  private static readonly CACHE_PATTERN = 'http:*:/appointments*';

  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly repo: IAppointmentRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  @Transactional()
  async execute(command: RestoreAppointmentCommand): Promise<void> {
    const { id, actorId } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('RestoreAppointmentHandler start', {
      traceId,
      appointmentId: id,
    });

    const appointment = await this.repo.findById(id);
    if (!appointment) {
      throw new NotFoundException(`Appointment with id ${id} not found`);
    }

    await this.repo.restore(id);

    await this.audit.log(
      {
        action: 'appointments.restored',
        actorId,
        resourceId: id,
        traceId,
      },
      { strict: true },
    );

    await this.cache.delByPattern(RestoreAppointmentHandler.CACHE_PATTERN);

    this.logger.info('RestoreAppointmentHandler end', {
      traceId,
      appointmentId: id,
    });
  }
}
