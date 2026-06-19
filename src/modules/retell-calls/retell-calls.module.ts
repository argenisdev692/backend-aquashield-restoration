import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '../../shared/cache/cache.module';
import { CompanyDataModule } from '../companydata/companydata.module';
import { ActivityLogService } from '../../shared/activity-log/activity-log.service';
import { WsJwtMiddleware } from '../../shared/websockets/ws-jwt.middleware';

// Controllers
import { RetellCallsController } from './infrastructure/api/controllers/retell-calls.controller';
import { RetellWebhookController } from './infrastructure/api/controllers/retell-webhook.controller';
import { RetellSignatureGuard } from './infrastructure/api/guards/retell-signature.guard';

// Use-cases
import { IngestCallWebhookUseCase } from './application/use-cases/ingest-call-webhook.use-case';
import { GetCallsListUseCase } from './application/use-cases/get-calls-list.use-case';
import { GetCallByIdUseCase } from './application/use-cases/get-call-by-id.use-case';
import { MarkCallReadUseCase } from './application/use-cases/mark-call-read.use-case';
import { DeleteCallUseCase } from './application/use-cases/delete-call.use-case';
import { RestoreCallUseCase } from './application/use-cases/restore-call.use-case';
import { BulkDeleteCallsUseCase } from './application/use-cases/bulk-delete-calls.use-case';
import { BulkRestoreCallsUseCase } from './application/use-cases/bulk-restore-calls.use-case';
import { ExportCallsUseCase } from './application/use-cases/export-calls.use-case';
import { SyncCallsUseCase } from './application/use-cases/sync-calls.use-case';

// Persistence
import { PrismaRetellCallRepository } from './infrastructure/persistence/repositories/prisma-retell-call.repository';
import { RETELL_CALL_REPOSITORY } from './domain/repositories/retell-call-repository.interface';

// Ports + adapters
import { AUDIT_PORT } from './domain/ports/outbound/audit.port.interface';
import { RetellSdkAdapter } from './infrastructure/external-services/retell-sdk.adapter';
import { RETELL_API_PORT } from './domain/ports/outbound/retell-api.port.interface';
import { RETELL_WEBHOOK_VERIFIER } from './domain/ports/outbound/webhook-verifier.port.interface';
import { ResendCallEmailAdapter } from './infrastructure/external-services/resend-call-email.adapter';
import { CALL_EMAIL_PORT } from './domain/ports/outbound/call-email.port.interface';
import { CompanyDataLookupAdapter } from './infrastructure/acl/companydata-lookup.adapter';
import { COMPANY_DATA_LOOKUP_PORT } from './domain/ports/outbound/company-data-lookup.port.interface';

// Realtime + listeners
import { RetellCallsGateway } from './infrastructure/gateways/retell-calls.gateway';
import { CallRecordedEmailListener } from './infrastructure/event-listeners/call-recorded-email.listener';
import { CallRealtimeListener } from './infrastructure/event-listeners/call-realtime.listener';

/**
 * Retell call-records bounded context (Hex/DDD, plain UseCases — no CQRS).
 * Ingests calls from the Retell `call_analyzed` webhook, persists them with
 * soft-delete, emails the company inbox on a new call, and exposes the
 * recording URL for browser playback.
 */
@Module({
  controllers: [RetellCallsController, RetellWebhookController],
  imports: [CacheModule, CompanyDataModule, JwtModule.register({})],
  providers: [
    // Use-cases
    IngestCallWebhookUseCase,
    GetCallsListUseCase,
    GetCallByIdUseCase,
    MarkCallReadUseCase,
    DeleteCallUseCase,
    RestoreCallUseCase,
    BulkDeleteCallsUseCase,
    BulkRestoreCallsUseCase,
    ExportCallsUseCase,
    SyncCallsUseCase,

    // Repository
    PrismaRetellCallRepository,
    { provide: RETELL_CALL_REPOSITORY, useClass: PrismaRetellCallRepository },

    // Audit — bind domain AUDIT_PORT to the shared activity-log writer
    ActivityLogService,
    { provide: AUDIT_PORT, useExisting: ActivityLogService },

    // Retell SDK adapter — REST client + webhook verifier
    RetellSdkAdapter,
    { provide: RETELL_API_PORT, useExisting: RetellSdkAdapter },
    { provide: RETELL_WEBHOOK_VERIFIER, useExisting: RetellSdkAdapter },

    // Email + company ACL
    ResendCallEmailAdapter,
    { provide: CALL_EMAIL_PORT, useExisting: ResendCallEmailAdapter },
    CompanyDataLookupAdapter,
    {
      provide: COMPANY_DATA_LOOKUP_PORT,
      useExisting: CompanyDataLookupAdapter,
    },

    // Webhook guard
    RetellSignatureGuard,

    // Realtime
    RetellCallsGateway,
    WsJwtMiddleware,

    // Event listeners
    CallRecordedEmailListener,
    CallRealtimeListener,
  ],
  exports: [RetellCallsGateway],
})
export class RetellCallsModule {}
