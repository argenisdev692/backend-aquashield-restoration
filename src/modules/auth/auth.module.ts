/**
 * Auth bounded context (Hex/DDD + UseCase per operation).
 *
 * CQRS justification: NONE — this module uses plain `@Injectable()` use
 * cases per operation. No CommandBus / QueryBus is registered. Domain
 * events are dispatched via `EventEmitter2` (per project rules).
 */
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// CryptoModule, SecurityModule, ActivityLogModule and ImageModule are
// @Global() in `shared/` — their providers resolve via DI without
// re-importing. StorageModule is NOT global so we import it explicitly
// (needed for the profile-photo upload).
import { StorageModule } from '../../shared/storage/storage.module';
import { QUEUE_NAMES } from '../../shared/messaging/queues.constants';
import {
  PERMISSION_REPOSITORY,
  PrismaPermissionRepository,
} from '../../core/access/permission.repository';

import { AuthController } from './infrastructure/api/controllers/auth.controller';
import { TwoFactorController } from './infrastructure/api/controllers/two-factor.controller';
import { SessionsController } from './infrastructure/api/controllers/sessions.controller';
import { SocialAuthController } from './infrastructure/api/controllers/social-auth.controller';

// Use cases
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { ResendVerificationCodeUseCase } from './application/use-cases/resend-verification-code.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { VerifyTwoFactorChallengeUseCase } from './application/use-cases/verify-two-factor-challenge.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { LogoutAllDevicesUseCase } from './application/use-cases/logout-all-devices.use-case';
import { GetMeUseCase } from './application/use-cases/get-me.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { SetupTotpUseCase } from './application/use-cases/setup-totp.use-case';
import { EnableTotpUseCase } from './application/use-cases/enable-totp.use-case';
import { DisableTotpUseCase } from './application/use-cases/disable-totp.use-case';
import { RegenerateBackupCodesUseCase } from './application/use-cases/regenerate-backup-codes.use-case';
import { UpdateMyProfileUseCase } from './application/use-cases/update-my-profile.use-case';
import { UploadProfilePhotoUseCase } from './application/use-cases/upload-profile-photo.use-case';
import { ListActiveSessionsUseCase } from './application/use-cases/list-active-sessions.use-case';
import { RevokeSessionUseCase } from './application/use-cases/revoke-session.use-case';
import { ListTrustedDevicesUseCase } from './application/use-cases/list-trusted-devices.use-case';
import { RevokeTrustedDeviceUseCase } from './application/use-cases/revoke-trusted-device.use-case';
import { GoogleOAuthCallbackUseCase } from './application/use-cases/google-oauth-callback.use-case';
import { UnlinkGoogleAccountUseCase } from './application/use-cases/unlink-google-account.use-case';
import { SessionIssuer } from './application/session-issuer.service';

// Repositories (Prisma)
import { PrismaUserAccountRepository } from './infrastructure/persistence/repositories/prisma-user-account.repository';
import { PrismaAuthSessionRepository } from './infrastructure/persistence/repositories/prisma-auth-session.repository';
import { PrismaOtpCodeRepository } from './infrastructure/persistence/repositories/prisma-otp-code.repository';
import { PrismaPasswordHistoryRepository } from './infrastructure/persistence/repositories/prisma-password-history.repository';
import { PrismaBackupCodeRepository } from './infrastructure/persistence/repositories/prisma-backup-code.repository';
import { PrismaTrustedDeviceRepository } from './infrastructure/persistence/repositories/prisma-trusted-device.repository';

// Adapters
import { NestJwtIssuerAdapter } from './infrastructure/adapters/nest-jwt-issuer.adapter';
import { OtplibTotpAdapter } from './infrastructure/adapters/otplib-totp.adapter';
import { GoogleOAuthAdapter } from './infrastructure/adapters/google-oauth.adapter';
import { RedisRateLimiterAdapter } from './infrastructure/adapters/redis-rate-limiter.adapter';
import { QueuedAuthEmailAdapter } from './infrastructure/adapters/queued-auth-email.adapter';
import { AuthEmailRenderer } from './infrastructure/adapters/auth-email-renderer.service';
import { AuthEmailProcessor } from './infrastructure/jobs/auth-email.processor';

// Guards
import { TwoFactorRequiredGuard } from './infrastructure/guards/two-factor-required.guard';
import { FreshPasswordGuard } from './infrastructure/guards/fresh-password.guard';

// Listeners
import { AuthNotificationListener } from './infrastructure/event-listeners/auth-notification.listener';

// Ports (DI symbols)
import { USER_ACCOUNT_REPOSITORY } from './domain/ports/user-account.repository.port';
import { AUTH_SESSION_REPOSITORY } from './domain/ports/auth-session.repository.port';
import { OTP_CODE_REPOSITORY } from './domain/ports/otp-code.repository.port';
import { PASSWORD_HISTORY_REPOSITORY } from './domain/ports/password-history.repository.port';
import { BACKUP_CODE_REPOSITORY } from './domain/ports/backup-code.repository.port';
import { TRUSTED_DEVICE_REPOSITORY } from './domain/ports/trusted-device.repository.port';
import { JWT_ISSUER } from './domain/ports/jwt-issuer.port';
import { TOTP_SERVICE } from './domain/ports/totp.port';
import { GOOGLE_OAUTH_PROVIDER } from './domain/ports/oauth-provider.port';
import { AUTH_EMAIL_SERVICE } from './domain/ports/auth-email.port';
import { AUTH_RATE_LIMITER } from './domain/ports/rate-limiter.port';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { algorithm: 'HS256' as const },
      }),
    }),
    EventEmitterModule,
    StorageModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.AUTH_EMAIL }),
  ],
  controllers: [
    AuthController,
    TwoFactorController,
    SessionsController,
    SocialAuthController,
  ],
  providers: [
    // Use cases
    RegisterUseCase,
    VerifyEmailUseCase,
    ResendVerificationCodeUseCase,
    LoginUseCase,
    VerifyTwoFactorChallengeUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    LogoutAllDevicesUseCase,
    GetMeUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    ChangePasswordUseCase,
    SetupTotpUseCase,
    EnableTotpUseCase,
    DisableTotpUseCase,
    RegenerateBackupCodesUseCase,
    UpdateMyProfileUseCase,
    UploadProfilePhotoUseCase,
    ListActiveSessionsUseCase,
    RevokeSessionUseCase,
    ListTrustedDevicesUseCase,
    RevokeTrustedDeviceUseCase,
    GoogleOAuthCallbackUseCase,
    UnlinkGoogleAccountUseCase,
    SessionIssuer,

    // Repositories
    PrismaUserAccountRepository,
    PrismaAuthSessionRepository,
    PrismaOtpCodeRepository,
    PrismaPasswordHistoryRepository,
    PrismaBackupCodeRepository,
    PrismaTrustedDeviceRepository,

    // Adapters
    NestJwtIssuerAdapter,
    OtplibTotpAdapter,
    GoogleOAuthAdapter,
    RedisRateLimiterAdapter,
    AuthEmailRenderer,
    QueuedAuthEmailAdapter,
    AuthEmailProcessor,

    // Local copy of PrismaPermissionRepository (CoreModule does not export it).
    PrismaPermissionRepository,

    // Guards
    TwoFactorRequiredGuard,
    FreshPasswordGuard,

    // Listeners
    AuthNotificationListener,

    // Port → Adapter bindings
    {
      provide: USER_ACCOUNT_REPOSITORY,
      useExisting: PrismaUserAccountRepository,
    },
    {
      provide: AUTH_SESSION_REPOSITORY,
      useExisting: PrismaAuthSessionRepository,
    },
    { provide: OTP_CODE_REPOSITORY, useExisting: PrismaOtpCodeRepository },
    {
      provide: PASSWORD_HISTORY_REPOSITORY,
      useExisting: PrismaPasswordHistoryRepository,
    },
    {
      provide: BACKUP_CODE_REPOSITORY,
      useExisting: PrismaBackupCodeRepository,
    },
    {
      provide: TRUSTED_DEVICE_REPOSITORY,
      useExisting: PrismaTrustedDeviceRepository,
    },
    { provide: JWT_ISSUER, useExisting: NestJwtIssuerAdapter },
    { provide: TOTP_SERVICE, useExisting: OtplibTotpAdapter },
    { provide: GOOGLE_OAUTH_PROVIDER, useExisting: GoogleOAuthAdapter },
    { provide: AUTH_EMAIL_SERVICE, useExisting: QueuedAuthEmailAdapter },
    { provide: AUTH_RATE_LIMITER, useExisting: RedisRateLimiterAdapter },
    {
      provide: PERMISSION_REPOSITORY,
      useExisting: PrismaPermissionRepository,
    },
  ],
  exports: [TwoFactorRequiredGuard, FreshPasswordGuard],
})
export class AuthModule {}
