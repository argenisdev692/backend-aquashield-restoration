import { Module } from '@nestjs/common';
import { AppointmentsController } from './infrastructure/api/controllers/appointments.controller';
import { PublicAppointmentsController } from './infrastructure/api/controllers/public-appointments.controller';
import { AppointmentsGateway } from './infrastructure/gateways/appointments.gateway';
import { CreateAppointmentUseCase } from './application/use-cases/create-appointment.use-case';
import { UpdateAppointmentUseCase } from './application/use-cases/update-appointment.use-case';
import { DeleteAppointmentUseCase } from './application/use-cases/delete-appointment.use-case';
import { GetAppointmentByIdUseCase } from './application/use-cases/get-appointment-by-id.use-case';
import { GetAppointmentsListUseCase } from './application/use-cases/get-appointments-list.use-case';
import { ExportAppointmentsUseCase } from './application/use-cases/export-appointments.use-case';
import { PrismaAppointmentRepository } from './infrastructure/persistence/repositories/prisma-appointment.repository';
import { APPOINTMENT_REPOSITORY } from './domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from './domain/ports/outbound/audit.port.interface';
import { EMAIL_PORT } from './domain/ports/outbound/email.port.interface';
import { AppointmentCreatedListener } from './infrastructure/event-listeners/appointment-created.listener';
import { AppointmentUpdatedListener } from './infrastructure/event-listeners/appointment-updated.listener';
import { AppointmentDeletedListener } from './infrastructure/event-listeners/appointment-deleted.listener';
import { StatusChangedListener } from './infrastructure/event-listeners/status-changed.listener';
import { AppointmentCreatedEmailListener } from './infrastructure/event-listeners/appointment-created-email.listener';
import { ActivityLogService } from '../../shared/activity-log/activity-log.service';
import { ConsoleEmailAdapter } from './infrastructure/external-services/console-email.adapter';
import { WsJwtMiddleware } from '../../shared/websockets/ws-jwt.middleware';

@Module({
  controllers: [AppointmentsController, PublicAppointmentsController],
  providers: [
    // Use Cases
    CreateAppointmentUseCase,
    UpdateAppointmentUseCase,
    DeleteAppointmentUseCase,
    GetAppointmentByIdUseCase,
    GetAppointmentsListUseCase,
    ExportAppointmentsUseCase,

    // Repository
    PrismaAppointmentRepository,
    { provide: APPOINTMENT_REPOSITORY, useClass: PrismaAppointmentRepository },

    // Ports — domain AUDIT_PORT bound to the shared ActivityLogService instance
    ActivityLogService,
    { provide: AUDIT_PORT, useExisting: ActivityLogService },
    { provide: EMAIL_PORT, useClass: ConsoleEmailAdapter },

    // WebSocket Gateway
    AppointmentsGateway,
    WsJwtMiddleware,

    // Event Listeners
    AppointmentCreatedListener,
    AppointmentUpdatedListener,
    AppointmentDeletedListener,
    StatusChangedListener,
    AppointmentCreatedEmailListener,
  ],
  exports: [AppointmentsGateway],
})
export class AppointmentsModule {}
