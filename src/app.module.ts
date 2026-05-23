import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { HealthModule } from './core/health/health.module';
import { LoggerModule } from './logger/logger.module';
import { validateEnv } from './shared/config/env.config';
import { buildClsOptions } from './shared/cls/cls.setup';
import { ActivityLogModule } from './shared/activity-log/activity-log.module';
import { CacheModule } from './shared/cache/cache.module';
import { CryptoModule } from './shared/crypto/crypto.module';
import { SecurityModule } from './shared/security/security.module';
import { DatabaseModule } from './shared/database/database.module';
import { PrismaService } from './shared/database/prisma.service';
import { QueueModule } from './shared/messaging/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyDataModule } from './modules/companydata/companydata.module';
import { BlogCategoryModule } from './modules/blog-category/blog-category.module';
import { UsersModule } from './modules/users/users.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { ContactSupportModule } from './modules/contact-support/contact-support.module';
import { RolesModule } from './modules/roles/roles.module';
import { UserPermissionsModule } from './modules/user-permissions/user-permissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    CqrsModule.forRoot(),
    ClsModule.forRoot({
      ...buildClsOptions(),
      plugins: [
        new ClsPluginTransactional({
          imports: [DatabaseModule],
          adapter: new TransactionalAdapterPrisma({
            prismaInjectionToken: PrismaService,
          }),
          // Proxy `PrismaService` so existing repositories that inject it
          // automatically see the active transaction within `@Transactional()`
          // boundaries — no need to inject TransactionHost everywhere.
          enableTransactionProxy: true,
        }),
      ],
    }),
    LoggerModule,
    DatabaseModule,
    CacheModule,
    CryptoModule,
    SecurityModule,
    ActivityLogModule,
    QueueModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000,
            limit: 3,
          },
          {
            name: 'medium',
            ttl: 10000,
            limit: 20,
          },
          {
            name: 'long',
            ttl: 60000,
            limit: 100,
          },
        ],
      }),
    }),
    CoreModule,
    HealthModule,
    AuthModule,
    CompanyDataModule,
    BlogCategoryModule,
    UsersModule,
    AppointmentsModule,
    ContactSupportModule,
    RolesModule,
    UserPermissionsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

