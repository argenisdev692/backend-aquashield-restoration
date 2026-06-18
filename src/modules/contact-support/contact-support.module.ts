import { Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ContactSupportController } from './infrastructure/api/controllers/contact-support.controller';
import { PublicContactSupportController } from './infrastructure/api/controllers/public-contact-support.controller';
import { CreateContactSupportUseCase } from './application/use-cases/create-contact-support.use-case';
import { MarkContactSupportReadUseCase } from './application/use-cases/mark-contact-support-read.use-case';
import { DeleteContactSupportUseCase } from './application/use-cases/delete-contact-support.use-case';
import { RestoreContactSupportUseCase } from './application/use-cases/restore-contact-support.use-case';
import { BulkDeleteContactSupportUseCase } from './application/use-cases/bulk-delete-contact-support.use-case';
import { BulkRestoreContactSupportUseCase } from './application/use-cases/bulk-restore-contact-support.use-case';
import { GetContactSupportByIdUseCase } from './application/use-cases/get-contact-support-by-id.use-case';
import { ListContactSupportUseCase } from './application/use-cases/list-contact-support.use-case';
import { ExportContactSupportUseCase } from './application/use-cases/export-contact-support.use-case';
import { PrismaContactSupportRepository } from './infrastructure/persistence/repositories/prisma-contact-support.repository';
import { ResendSupportEmailAdapter } from './infrastructure/adapters/resend-support-email.adapter';
import { UsersAdminRecipientsAdapter } from './infrastructure/acl/users-admin-recipients.adapter';
import { ContactSupportGateway } from './infrastructure/gateways/contact-support.gateway';
import { ContactSupportCreatedListener } from './infrastructure/event-listeners/contact-support-created.listener';
import { ContactSupportReadListener } from './infrastructure/event-listeners/contact-support-read.listener';
import { WsJwtMiddleware } from '../../shared/websockets/ws-jwt.middleware';
import { CONTACT_SUPPORT_REPOSITORY } from './domain/ports/contact-support.repository.interface';
import { SUPPORT_EMAIL_PORT } from './domain/ports/support-email.port';
import { ADMIN_RECIPIENTS_PORT } from './domain/ports/admin-recipients.port';

const UseCases: Provider[] = [
  CreateContactSupportUseCase,
  MarkContactSupportReadUseCase,
  DeleteContactSupportUseCase,
  RestoreContactSupportUseCase,
  BulkDeleteContactSupportUseCase,
  BulkRestoreContactSupportUseCase,
  GetContactSupportByIdUseCase,
  ListContactSupportUseCase,
  ExportContactSupportUseCase,
];

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
  controllers: [ContactSupportController, PublicContactSupportController],
  providers: [
    ...UseCases,
    WsJwtMiddleware,
    ResendSupportEmailAdapter,
    UsersAdminRecipientsAdapter,
    ContactSupportGateway,
    ContactSupportCreatedListener,
    ContactSupportReadListener,
    {
      provide: CONTACT_SUPPORT_REPOSITORY,
      useClass: PrismaContactSupportRepository,
    },
    { provide: SUPPORT_EMAIL_PORT, useExisting: ResendSupportEmailAdapter },
    {
      provide: ADMIN_RECIPIENTS_PORT,
      useExisting: UsersAdminRecipientsAdapter,
    },
  ],
})
export class ContactSupportModule {}
