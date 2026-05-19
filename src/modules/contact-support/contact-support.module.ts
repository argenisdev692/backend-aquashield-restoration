import { Module, Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ContactSupportController } from './infrastructure/api/controllers/contact-support.controller';
import { CreateContactSupportHandler } from './application/commands/handlers/create-contact-support.handler';
import { MarkContactSupportReadHandler } from './application/commands/handlers/mark-contact-support-read.handler';
import { DeleteContactSupportHandler } from './application/commands/handlers/delete-contact-support.handler';
import { RestoreContactSupportHandler } from './application/commands/handlers/restore-contact-support.handler';
import { GetContactSupportByIdHandler } from './application/queries/handlers/get-contact-support-by-id.handler';
import { ListContactSupportHandler } from './application/queries/handlers/list-contact-support.handler';
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

const CommandHandlers: Provider[] = [
  CreateContactSupportHandler,
  MarkContactSupportReadHandler,
  DeleteContactSupportHandler,
  RestoreContactSupportHandler,
];

const QueryHandlers: Provider[] = [
  GetContactSupportByIdHandler,
  ListContactSupportHandler,
];

@Module({
  imports: [
    CqrsModule,
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
  controllers: [ContactSupportController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
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
