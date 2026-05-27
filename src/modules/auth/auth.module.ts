import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { ImageModule } from '../../shared/image/image.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { CacheModule } from '../../shared/cache/cache.module';
import { DatabaseModule } from '../../shared/database/database.module';
import { LoggerModule } from '../../logger/logger.module';

// ─── Infrastructure Services ───────────────────────────────────────────────
import { AuthTokenIssuer } from './services/auth-token-issuer.service';

// ─── Guards ───────────────────────────────────────────────────────────────────
import { FreshPasswordGuard } from './guards/fresh-password.guard';

// ─── Adapters ───────────────────────────────────────────────────────────────
import { ResendEmailAdapter } from './adapters/resend-email.adapter';
import { OtplibTotpAdapter } from './adapters/otplib-totp.adapter';
import { BcryptPasswordHasherAdapter } from './adapters/bcrypt-password-hasher.adapter';
import { JwtTokenAdapter } from './adapters/jwt-token.adapter';
import { GoogleAuthAdapter } from './adapters/google-auth.adapter';

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
    ImageModule,
    StorageModule,
    CacheModule,
    DatabaseModule,
    LoggerModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    AuthTokenIssuer,
    FreshPasswordGuard,
    ResendEmailAdapter,
    OtplibTotpAdapter,
    BcryptPasswordHasherAdapter,
    JwtTokenAdapter,
    GoogleAuthAdapter,
  ],
  exports: [AuthService],
})
export class AuthModule {}
