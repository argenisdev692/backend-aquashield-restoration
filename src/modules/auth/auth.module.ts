import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './infrastructure/api/controllers/auth.controller';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { VerifyOtpUseCase } from './application/use-cases/verify-otp.use-case';
import { VerifyTotpUseCase } from './application/use-cases/verify-totp.use-case';
import { AuthTokenIssuer } from './application/services/auth-token-issuer.service';
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
import { OtplibTotpAdapter } from './infrastructure/adapters/otplib-totp.adapter';
import { BcryptPasswordHasherAdapter } from './infrastructure/adapters/bcrypt-password-hasher.adapter';
import { JwtTokenAdapter } from './infrastructure/adapters/jwt-token.adapter';
import { AuthEventListener } from './infrastructure/event-listeners/auth-event.listener';
import { AUTH_SESSION_REPOSITORY } from './domain/repositories/auth-session.repository.interface';
import { OTP_REPOSITORY } from './domain/repositories/otp.repository.interface';
import { USER_AUTH_REPOSITORY } from './domain/repositories/user-auth.repository.interface';
import { EMAIL_PORT } from './domain/ports/outbound/email.port';
import { TOTP_PORT } from './domain/ports/outbound/totp.port';
import { PASSWORD_HASHER_PORT } from './domain/ports/outbound/password-hasher.port';
import { TOKEN_SERVICE_PORT } from './domain/ports/outbound/token-service.port';
import { AUDIT_PORT } from '../../shared/activity-log/audit.port';
import { ActivityLogService } from '../../shared/activity-log/activity-log.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // The single source of truth for `expiresIn` is `JwtTokenAdapter`
      // (env `JWT_ACCESS_EXPIRES_IN`). Module-level signOptions only pins
      // the algorithm so it cannot be silently downgraded.
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    VerifyOtpUseCase,
    VerifyTotpUseCase,
    Enable2faUseCase,
    Confirm2faUseCase,
    Disable2faUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    LogoutAllSessionsUseCase,
    AuthTokenIssuer,
    AuthEventListener,
    PrismaAuthSessionRepository,
    PrismaOtpRepository,
    PrismaUserAuthRepository,
    NodemailerEmailAdapter,
    OtplibTotpAdapter,
    BcryptPasswordHasherAdapter,
    JwtTokenAdapter,
    {
      provide: AUTH_SESSION_REPOSITORY,
      useExisting: PrismaAuthSessionRepository,
    },
    { provide: OTP_REPOSITORY, useExisting: PrismaOtpRepository },
    { provide: USER_AUTH_REPOSITORY, useExisting: PrismaUserAuthRepository },
    { provide: EMAIL_PORT, useExisting: NodemailerEmailAdapter },
    { provide: TOTP_PORT, useExisting: OtplibTotpAdapter },
    { provide: PASSWORD_HASHER_PORT, useExisting: BcryptPasswordHasherAdapter },
    { provide: TOKEN_SERVICE_PORT, useExisting: JwtTokenAdapter },
    { provide: AUDIT_PORT, useExisting: ActivityLogService },
  ],
  exports: [
    LoginUseCase,
    VerifyOtpUseCase,
    VerifyTotpUseCase,
    RefreshTokenUseCase,
  ],
})
export class AuthModule {}
