import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './infrastructure/api/controllers/auth.controller';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { VerifyOtpUseCase } from './application/use-cases/verify-otp.use-case';
import { Enable2faUseCase } from './application/use-cases/enable-2fa.use-case';
import { Confirm2faUseCase } from './application/use-cases/confirm-2fa.use-case';
import { Disable2faUseCase } from './application/use-cases/disable-2fa.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { LogoutAllSessionsUseCase } from './application/use-cases/logout-all-sessions.use-case';
import { PrismaAuthSessionRepository } from './infrastructure/persistence/repositories/prisma-auth-session.repository';
import { PrismaOtpRepository } from './infrastructure/persistence/repositories/prisma-otp.repository';
import { PrismaUserAuthRepository } from './infrastructure/persistence/repositories/prisma-user-auth.repository';
import { NodemailerEmailAdapter } from './infrastructure/adapters/nodemailer-email.adapter';
import { AuthEventListener } from './infrastructure/event-listeners/auth-event.listener';
import {
  AUTH_SESSION_REPOSITORY,
} from './domain/repositories/auth-session.repository.interface';
import { OTP_REPOSITORY } from './domain/repositories/otp.repository.interface';
import {
  USER_AUTH_REPOSITORY,
} from './domain/repositories/user-auth.repository.interface';
import { EMAIL_PORT } from './domain/ports/outbound/email.port';
import { AUDIT_PORT } from '../../shared/activity-log/audit.port';
import { ActivityLogService } from '../../shared/activity-log/activity-log.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: 900,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    VerifyOtpUseCase,
    Enable2faUseCase,
    Confirm2faUseCase,
    Disable2faUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    LogoutAllSessionsUseCase,
    AuthEventListener,
    PrismaAuthSessionRepository,
    PrismaOtpRepository,
    PrismaUserAuthRepository,
    NodemailerEmailAdapter,
    {
      provide: AUTH_SESSION_REPOSITORY,
      useExisting: PrismaAuthSessionRepository,
    },
    { provide: OTP_REPOSITORY, useExisting: PrismaOtpRepository },
    { provide: USER_AUTH_REPOSITORY, useExisting: PrismaUserAuthRepository },
    { provide: EMAIL_PORT, useExisting: NodemailerEmailAdapter },
    { provide: AUDIT_PORT, useExisting: ActivityLogService },
  ],
  exports: [LoginUseCase, VerifyOtpUseCase, RefreshTokenUseCase],
})
export class AuthModule {}
