import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CacheModule } from '../../shared/cache/cache.module';
import { AppointmentsController } from './infrastructure/api/controllers/appointments.controller';
import { PublicAppointmentsController } from './infrastructure/api/controllers/public-appointments.controller';
import { AppointmentsGateway } from './infrastructure/gateways/appointments.gateway';
// Command Handlers
import { CreateAppointmentHandler } from './application/commands/handlers/create-appointment.handler';
import { UpdateAppointmentHandler } from './application/commands/handlers/update-appointment.handler';
import { DeleteAppointmentHandler } from './application/commands/handlers/delete-appointment.handler';
import { MarkAppointmentReadHandler } from './application/commands/handlers/mark-appointment-read.handler';
import { RestoreAppointmentHandler } from './application/commands/handlers/restore-appointment.handler';
import { BulkDeleteAppointmentsHandler } from './application/commands/handlers/bulk-delete-appointments.handler';
import { BulkRestoreAppointmentsHandler } from './application/commands/handlers/bulk-restore-appointments.handler';

// Query Handlers
import { GetAppointmentByIdHandler } from './application/queries/handlers/get-appointment-by-id.handler';
import { GetAppointmentsListHandler } from './application/queries/handlers/get-appointments-list.handler';
import { ExportAppointmentsHandler } from './application/queries/handlers/export-appointments.handler';
import { PrismaAppointmentRepository } from './infrastructure/persistence/repositories/prisma-appointment.repository';
import { APPOINTMENT_REPOSITORY } from './domain/repositories/appointment-repository.interface';
import { AUDIT_PORT } from './domain/ports/outbound/audit.port.interface';
import { EMAIL_PORT } from './domain/ports/outbound/email.port.interface';
import { ADMIN_RECIPIENTS_PORT } from './domain/ports/outbound/admin-recipients.port.interface';
import { AppointmentCreatedListener } from './infrastructure/event-listeners/appointment-created.listener';
import { AppointmentReadListener } from './infrastructure/event-listeners/appointment-read.listener';
import { AppointmentUpdatedListener } from './infrastructure/event-listeners/appointment-updated.listener';
import { AppointmentDeletedListener } from './infrastructure/event-listeners/appointment-deleted.listener';
import { StatusChangedListener } from './infrastructure/event-listeners/status-changed.listener';
import { AppointmentCreatedEmailListener } from './infrastructure/event-listeners/appointment-created-email.listener';
import { AppointmentsBulkListener } from './infrastructure/event-listeners/appointments-bulk-deleted.listener';
import { ActivityLogService } from '../../shared/activity-log/activity-log.service';
import { ResendAppointmentEmailAdapter } from './infrastructure/external-services/resend-appointment-email.adapter';
import { UsersAdminRecipientsAdapter } from './infrastructure/acl/users-admin-recipients.adapter';
import { WsJwtMiddleware } from '../../shared/websockets/ws-jwt.middleware';

/**
 * CQRS bus is used in this bounded context because appointments coordinate
 * 7 domain events across the WebSocket gateway, email port, and audit
 * listener — the Command/Query separation keeps each side-effect chain in
 * its own handler. `CqrsModule.forRoot()` is registered globally in
 * `AppModule`; importing it here is a no-op kept for explicitness.
 */
@Module({
  controllers: [AppointmentsController, PublicAppointmentsController],
  imports: [CqrsModule, CacheModule],
  providers: [
    // Command Handlers
    CreateAppointmentHandler,
    UpdateAppointmentHandler,
    DeleteAppointmentHandler,
    MarkAppointmentReadHandler,
    RestoreAppointmentHandler,
    BulkDeleteAppointmentsHandler,
    BulkRestoreAppointmentsHandler,

    // Query Handlers
    GetAppointmentByIdHandler,
    GetAppointmentsListHandler,
    ExportAppointmentsHandler,

    // Repository
    PrismaAppointmentRepository,
    { provide: APPOINTMENT_REPOSITORY, useClass: PrismaAppointmentRepository },

    // Ports — domain AUDIT_PORT bound to the shared ActivityLogService instance
    ActivityLogService,
    { provide: AUDIT_PORT, useExisting: ActivityLogService },
    ResendAppointmentEmailAdapter,
    { provide: EMAIL_PORT, useExisting: ResendAppointmentEmailAdapter },
    UsersAdminRecipientsAdapter,
    {
      provide: ADMIN_RECIPIENTS_PORT,
      useExisting: UsersAdminRecipientsAdapter,
    },

    // WebSocket Gateway
    AppointmentsGateway,
    WsJwtMiddleware,

    // Event Listeners
    AppointmentCreatedListener,
    AppointmentReadListener,
    AppointmentUpdatedListener,
    AppointmentDeletedListener,
    StatusChangedListener,
    AppointmentCreatedEmailListener,
    AppointmentsBulkListener,
  ],
  exports: [AppointmentsGateway],
})
export class AppointmentsModule {}
