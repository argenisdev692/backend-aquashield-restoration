import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '../../shared/cache/cache.module';

import { CampaignsController } from './infrastructure/api/controllers/campaigns.controller';
import { CampaignsGateway } from './infrastructure/gateways/campaigns.gateway';

import { QUEUE_NAMES } from '../../shared/messaging/queues.constants';

// Command Handlers
import { RequestCampaignExportHandler } from './application/commands/handlers/request-campaign-export.handler';

// Query Handlers
import { GetCampaignExportStatusHandler } from './application/queries/handlers/get-campaign-export-status.handler';
import { ListMyCampaignExportsHandler } from './application/queries/handlers/list-my-campaign-exports.handler';
import { ExportCampaignExportsHandler } from './application/queries/handlers/export-campaign-exports.handler';

// Repository
import { CAMPAIGN_GENERATION_REPOSITORY } from './domain/ports/campaign-generation.repository.port';
import { PrismaCampaignGenerationRepository } from './infrastructure/persistence/repositories/prisma-campaign-generation.repository';

// Ports
import { STAGE_EXPORT_GENERATOR_PORT } from './domain/ports/stage-export-generator.port';
import { AUDIO_GENERATOR_PORT } from './domain/ports/audio-generator.port';
import { IMAGE_GENERATOR_PORT } from './domain/ports/image-generator.port';
import { PDF_BUILDER_PORT } from './domain/ports/pdf-builder.port';
import { ZIP_PACKER_PORT } from './domain/ports/zip-packer.port';
import { VIRALITY_RESEARCH_PORT } from './domain/ports/virality-research.port';
import { AI_DETECTION_PORT } from './domain/ports/ai-detection.port';

// Shared
import { StorageModule } from '../../shared/storage/storage.module';
import { AUDIT_PORT } from '../../shared/activity-log/audit.port';
import { ActivityLogService } from '../../shared/activity-log/activity-log.service';

// Event listeners
import { CampaignExportRequestedListener } from './infrastructure/event-listeners/campaign-export-requested.listener';
import { CampaignStageReadyListener } from './infrastructure/event-listeners/campaign-stage-ready.listener';
import { CampaignExportCompletedListener } from './infrastructure/event-listeners/campaign-export-completed.listener';

// BullMQ Processor
import { CampaignExportProcessor } from './infrastructure/jobs/campaign-export.processor';

// Stub adapters (replace with real implementations)
import { StubStageExportGeneratorAdapter } from './infrastructure/adapters/stub/stub-stage-export-generator.adapter';
import { StubPdfBuilderAdapter } from './infrastructure/adapters/stub/stub-pdf-builder.adapter';
import { StubZipPackerAdapter } from './infrastructure/adapters/stub/stub-zip-packer.adapter';
import { StubAudioGeneratorAdapter } from './infrastructure/adapters/stub/stub-audio-generator.adapter';
import { StubImageGeneratorAdapter } from './infrastructure/adapters/stub/stub-image-generator.adapter';
import { StubViralityResearchAdapter } from './infrastructure/adapters/stub/stub-virality-research.adapter';
import { StubAiDetectionAdapter } from './infrastructure/adapters/stub/stub-ai-detection.adapter';

// Cross-context ACL for CompanyData (business name resolution)
import { COMPANY_DATA_LOOKUP_PORT } from './domain/ports/outbound/company-data-lookup.port';
import { PrismaCompanyDataLookupAdapter } from './infrastructure/adapters/company-data-lookup.adapter';
import { CompanyDataRepository } from '../companydata/companydata.repository';

@Module({
  imports: [
    CqrsModule,
    CacheModule,
    StorageModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.CAMPAIGN_EXPORT,
    }),
  ],
  controllers: [CampaignsController],
  providers: [
    // Command Handlers
    RequestCampaignExportHandler,

    // Query Handlers
    GetCampaignExportStatusHandler,
    ListMyCampaignExportsHandler,
    ExportCampaignExportsHandler,

    // Repository
    PrismaCampaignGenerationRepository,
    {
      provide: CAMPAIGN_GENERATION_REPOSITORY,
      useExisting: PrismaCampaignGenerationRepository,
    },

    // Audit
    {
      provide: AUDIT_PORT,
      useExisting: ActivityLogService,
    },

    // WebSocket Gateway
    CampaignsGateway,

    // Event Listeners
    CampaignExportRequestedListener,
    CampaignStageReadyListener,
    CampaignExportCompletedListener,

    // BullMQ Processor
    CampaignExportProcessor,

    // ─── Port Bindings (Stubs for now — replace with real adapters) ─────────
    {
      provide: STAGE_EXPORT_GENERATOR_PORT,
      useClass: StubStageExportGeneratorAdapter,
    },
    {
      provide: PDF_BUILDER_PORT,
      useClass: StubPdfBuilderAdapter,
    },
    {
      provide: ZIP_PACKER_PORT,
      useClass: StubZipPackerAdapter,
    },
    {
      provide: AUDIO_GENERATOR_PORT,
      useClass: StubAudioGeneratorAdapter,
    },
    {
      provide: IMAGE_GENERATOR_PORT,
      useClass: StubImageGeneratorAdapter,
    },
    {
      provide: VIRALITY_RESEARCH_PORT,
      useClass: StubViralityResearchAdapter,
    },
    {
      provide: AI_DETECTION_PORT,
      useClass: StubAiDetectionAdapter,
    },

    // Cross-context ACL: resolve real company name from CompanyData at request time
    CompanyDataRepository,
    {
      provide: COMPANY_DATA_LOOKUP_PORT,
      useClass: PrismaCompanyDataLookupAdapter,
    },
  ],
})
export class CampaignsModule {}
