import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { UsersController } from './infrastructure/api/controllers/users.controller';

import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { SetupPasswordUseCase } from './application/use-cases/setup-password.use-case';
import { RequestPasswordChangeUseCase } from './application/use-cases/request-password-change.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { GetUserByIdUseCase } from './application/use-cases/get-user-by-id.use-case';
import { GetUsersListUseCase } from './application/use-cases/get-users-list.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';
import { DeleteUserUseCase } from './application/use-cases/delete-user.use-case';
import { ExportUsersUseCase } from './application/use-cases/export-users.use-case';
import { CheckEmailExistsUseCase } from './application/use-cases/check-email-exists.use-case';
import { CheckUsernameExistsUseCase } from './application/use-cases/check-username-exists.use-case';

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
  imports: [EventEmitterModule],
  controllers: [UsersController],
  providers: [
    CreateUserUseCase,
    SetupPasswordUseCase,
    RequestPasswordChangeUseCase,
    ChangePasswordUseCase,
    GetUserByIdUseCase,
    GetUsersListUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    ExportUsersUseCase,
    CheckEmailExistsUseCase,
    CheckUsernameExistsUseCase,

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
