import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ZodValidationPipe } from 'nestjs-zod';
import { CaslAbilityFactory } from './access/casl-ability.factory';
import {
  PERMISSION_REPOSITORY,
  PrismaPermissionRepository,
} from './access/permission.repository';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { CaslGuard } from './guards/casl.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './guards/jwt.strategy';
import { SpamFilterGuard } from './guards/spam-filter.guard';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { CacheTtlInterceptor } from './interceptors/cache-ttl.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

/**
 * Global cross-cutting wiring.
 *
 * - Global pipe: nestjs-zod (validates `createZodDto` bodies automatically).
 * - Global filter: RFC 7807 problem responses.
 * - Global interceptors (in order): logging → cache → audit.
 * - Access stack: permission repo + CASL factory + the two guards
 *   (applied per-controller via `@UseGuards(JwtAuthGuard, CaslGuard)`).
 */
@Global()
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [
    PrismaPermissionRepository,
    { provide: PERMISSION_REPOSITORY, useExisting: PrismaPermissionRepository },
    CaslAbilityFactory,
    JwtStrategy,
    JwtAuthGuard,
    CaslGuard,
    SpamFilterGuard,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: CacheTtlInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [
    CaslAbilityFactory,
    JwtAuthGuard,
    CaslGuard,
    SpamFilterGuard,
    PassportModule,
  ],
})
export class CoreModule {}
