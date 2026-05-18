import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './infrastructure/api/controllers/auth.controller';

// ─── Use Cases ────────────────────────────────────────────────────────────────
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { LogoutAllSessionsUseCase } from './application/use-cases/logout-all-sessions.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { GetMeUseCase } from './application/use-cases/get-me.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset.use-case';
import { ValidateResetTokenUseCase } from './application/use-cases/validate-reset-token.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { ResendVerificationEmailUseCase } from './application/use-cases/resend-verification-email.use-case';
import { GetPasswordConfirmationStatusUseCase } from './application/use-cases/get-password-confirmation-status.use-case';
import { ConfirmPasswordUseCase } from './application/use-cases/confirm-password.use-case';
import { VerifyTwoFactorChallengeUseCase } from './application/use-cases/verify-two-factor-challenge.use-case';
import { GoogleAuthUseCase } from './application/use-cases/google-auth.use-case';
import { VerifyOtpUseCase } from './application/use-cases/verify-otp.use-case';
import { VerifyTotpUseCase } from './application/use-cases/verify-totp.use-case';
import { Enable2faUseCase } from './application/use-cases/enable-2fa.use-case';
import { Confirm2faUseCase } from './application/use-cases/confirm-2fa.use-case';
import { Disable2faUseCase } from './application/use-cases/disable-2fa.use-case';
import { ChangeExpiredPasswordUseCase } from './application/use-cases/change-expired-password.use-case';

// ─── Application Services ─────────────────────────────────────────────────────
import { AuthTokenIssuer } from './application/services/auth-token-issuer.service';

// ─── Infrastructure Repositories ─────────────────────────────────────────────
import { PrismaAuthSessionRepository } from './infrastructure/persistence/repositories/prisma-auth-session.repository';
import { PrismaOtpRepository } from './infrastructure/persistence/repositories/prisma-otp.repository';
import { PrismaUserAuthRepository } from './infrastructure/persistence/repositories/prisma-user-auth.repository';
import { PrismaPasswordResetRepository } from './infrastructure/persistence/repositories/prisma-password-reset.repository';
import { PrismaPasswordHistoryRepository } from './infrastructure/persistence/repositories/prisma-password-history.repository';

// ─── Infrastructure Adapters ──────────────────────────────────────────────────
import { ResendEmailAdapter } from './infrastructure/adapters/resend-email.adapter';
import { OtplibTotpAdapter } from './infrastructure/adapters/otplib-totp.adapter';
import { BcryptPasswordHasherAdapter } from './infrastructure/adapters/bcrypt-password-hasher.adapter';
import { JwtTokenAdapter } from './infrastructure/adapters/jwt-token.adapter';
import { GoogleAuthAdapter } from './infrastructure/adapters/google-auth.adapter';

// ─── Event Listeners ──────────────────────────────────────────────────────────
import { AuthEventListener } from './infrastructure/event-listeners/auth-event.listener';

// ─── Domain Symbols ───────────────────────────────────────────────────────────
import { AUTH_SESSION_REPOSITORY } from './domain/repositories/auth-session.repository.interface';
import { OTP_REPOSITORY } from './domain/repositories/otp.repository.interface';
import { USER_AUTH_REPOSITORY } from './domain/repositories/user-auth.repository.interface';
import { PASSWORD_RESET_REPOSITORY } from './domain/repositories/password-reset.repository.interface';
import { PASSWORD_HISTORY_REPOSITORY } from './domain/repositories/password-history.repository.interface';
import { EMAIL_PORT } from './domain/ports/outbound/email.port';
import { TOTP_PORT } from './domain/ports/outbound/totp.port';
import { PASSWORD_HASHER_PORT } from './domain/ports/outbound/password-hasher.port';
import { TOKEN_SERVICE_PORT } from './domain/ports/outbound/token-service.port';
import { GOOGLE_AUTH_PORT } from './domain/ports/outbound/google-auth.port';
import { AUDIT_PORT } from '../../shared/activity-log/audit.port';
import { ActivityLogService } from '../../shared/activity-log/activity-log.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    // ─── Use Cases ───────────────────────────────────────────────────────────
    LoginUseCase,
    LogoutUseCase,
    LogoutAllSessionsUseCase,
    RefreshTokenUseCase,
    RegisterUseCase,
    GetMeUseCase,
    UpdateProfileUseCase,
    RequestPasswordResetUseCase,
    ValidateResetTokenUseCase,
    ResetPasswordUseCase,
    VerifyEmailUseCase,
    ResendVerificationEmailUseCase,
    GetPasswordConfirmationStatusUseCase,
    ConfirmPasswordUseCase,
    VerifyTwoFactorChallengeUseCase,
    GoogleAuthUseCase,
    VerifyOtpUseCase,
    VerifyTotpUseCase,
    Enable2faUseCase,
    Confirm2faUseCase,
    Disable2faUseCase,
    ChangeExpiredPasswordUseCase,

    // ─── Services ────────────────────────────────────────────────────────────
    AuthTokenIssuer,
    AuthEventListener,

    // ─── Repositories (concrete classes + symbol bindings) ───────────────────
    PrismaAuthSessionRepository,
    PrismaOtpRepository,
    PrismaUserAuthRepository,
    PrismaPasswordResetRepository,
    PrismaPasswordHistoryRepository,
    { provide: AUTH_SESSION_REPOSITORY, useExisting: PrismaAuthSessionRepository },
    { provide: OTP_REPOSITORY, useExisting: PrismaOtpRepository },
    { provide: USER_AUTH_REPOSITORY, useExisting: PrismaUserAuthRepository },
    { provide: PASSWORD_RESET_REPOSITORY, useExisting: PrismaPasswordResetRepository },
    { provide: PASSWORD_HISTORY_REPOSITORY, useExisting: PrismaPasswordHistoryRepository },

    // ─── Adapters (concrete classes + symbol bindings) ───────────────────────
    ResendEmailAdapter,
    OtplibTotpAdapter,
    BcryptPasswordHasherAdapter,
    JwtTokenAdapter,
    GoogleAuthAdapter,
    { provide: EMAIL_PORT, useExisting: ResendEmailAdapter },
    { provide: TOTP_PORT, useExisting: OtplibTotpAdapter },
    { provide: PASSWORD_HASHER_PORT, useExisting: BcryptPasswordHasherAdapter },
    { provide: TOKEN_SERVICE_PORT, useExisting: JwtTokenAdapter },
    { provide: GOOGLE_AUTH_PORT, useExisting: GoogleAuthAdapter },
    { provide: AUDIT_PORT, useExisting: ActivityLogService },
  ],
  exports: [
    LoginUseCase,
    VerifyOtpUseCase,
    VerifyTotpUseCase,
    RefreshTokenUseCase,
    GetMeUseCase,
  ],
})
export class AuthModule {}
