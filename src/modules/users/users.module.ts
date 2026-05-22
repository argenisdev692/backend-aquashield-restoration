// CQRS justification (per backend-nest.md "CommandBus/QueryBus requires explicit
// per-context decision"): the users bounded context owns multi-step workflows
// (create → token → email; setup-password → password-change-event) and emits
// three domain events. Splitting writes into CommandHandlers and reads into
// QueryHandlers keeps each unit testable in isolation and matches the
// Hex/DDD layout already in place (`domain/ application/ infrastructure/`).
// The team has approved using `@nestjs/cqrs` for this module specifically;
// other bounded contexts must default to plain UseCase classes unless they
// meet the same trigger.
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { UsersController } from './infrastructure/api/controllers/users.controller';

import { CreateUserHandler } from './application/commands/handlers/create-user.handler';
import { SetupPasswordHandler } from './application/commands/handlers/setup-password.handler';
import { RequestPasswordChangeHandler } from './application/commands/handlers/request-password-change.handler';
import { ChangePasswordHandler } from './application/commands/handlers/change-password.handler';
import { UpdateUserHandler } from './application/commands/handlers/update-user.handler';
import { DeleteUserHandler } from './application/commands/handlers/delete-user.handler';
import { BulkDeleteUsersHandler } from './application/commands/handlers/bulk-delete-users.handler';
import { BulkRestoreUsersHandler } from './application/commands/handlers/bulk-restore-users.handler';
import { ExportUsersHandler } from './application/commands/handlers/export-users.handler';
import { GetUserByIdHandler } from './application/queries/handlers/get-user-by-id.handler';
import { GetUsersListHandler } from './application/queries/handlers/get-users-list.handler';
import { CheckEmailExistsHandler } from './application/queries/handlers/check-email-exists.handler';
import { CheckUsernameExistsHandler } from './application/queries/handlers/check-username-exists.handler';

import { PrismaUserRepository } from './infrastructure/persistence/repositories/prisma-user.repository';
import { PrismaPasswordSetupRepository } from './infrastructure/persistence/repositories/prisma-password-setup.repository';
import { ResendEmailAdapter } from './infrastructure/adapters/resend-email.adapter';
import { BcryptPasswordHasherAdapter } from './infrastructure/adapters/bcrypt-password-hasher.adapter';
import { UserEventListener } from './infrastructure/event-listeners/user-event.listener';

import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';
import { PASSWORD_SETUP_REPOSITORY } from './domain/repositories/password-setup.repository.interface';
import { EMAIL_PORT } from './domain/ports/outbound/email.port';
import { PASSWORD_HASHER_PORT } from './domain/ports/outbound/password-hasher.port';
import { AUDIT_PORT } from '../../shared/activity-log/audit.port';
import { ActivityLogService } from '../../shared/activity-log/activity-log.service';

@Module({
  imports: [CqrsModule, EventEmitterModule],
  controllers: [UsersController],
  providers: [
    CreateUserHandler,
    SetupPasswordHandler,
    RequestPasswordChangeHandler,
    ChangePasswordHandler,
    GetUserByIdHandler,
    GetUsersListHandler,
    UpdateUserHandler,
    DeleteUserHandler,
    BulkDeleteUsersHandler,
    BulkRestoreUsersHandler,
    ExportUsersHandler,
    CheckEmailExistsHandler,
    CheckUsernameExistsHandler,

    PrismaUserRepository,
    PrismaPasswordSetupRepository,
    ResendEmailAdapter,
    BcryptPasswordHasherAdapter,
    UserEventListener,

    { provide: USER_REPOSITORY, useExisting: PrismaUserRepository },
    {
      provide: PASSWORD_SETUP_REPOSITORY,
      useExisting: PrismaPasswordSetupRepository,
    },
    { provide: EMAIL_PORT, useExisting: ResendEmailAdapter },
    {
      provide: PASSWORD_HASHER_PORT,
      useExisting: BcryptPasswordHasherAdapter,
    },
    { provide: AUDIT_PORT, useExisting: ActivityLogService },
  ],
})
export class UsersModule {}
