import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '../../shared/cache/cache.module';

import { CampaignsController } from './infrastructure/api/controllers/campaigns.controller';
import { CampaignsGateway } from './infrastructure/gateways/campaigns.gateway';
import { WsJwtMiddleware } from '../../shared/websockets/ws-jwt.middleware';

import { QUEUE_NAMES } from '../../shared/messaging/queues.constants';

// Command Handlers
import { RequestCampaignExportHandler } from './application/commands/handlers/request-campaign-export.handler';
import { DeleteCampaignHandler } from './application/commands/handlers/delete-campaign.handler';
import { BulkDeleteCampaignsHandler } from './application/commands/handlers/bulk-delete-campaigns.handler';
import { GenerateTopicsHandler } from './application/commands/handlers/generate-topics.handler';
import { GenerateCampaignHandler } from './application/commands/handlers/generate-campaign.handler';

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
import { CACHE_PORT } from '../../shared/cache/cache.port';
import { CacheService } from '../../shared/cache/cache.service';

// Event listeners
import { CampaignExportRequestedListener } from './infrastructure/event-listeners/campaign-export-requested.listener';
import { CampaignStageReadyListener } from './infrastructure/event-listeners/campaign-stage-ready.listener';
import { CampaignExportCompletedListener } from './infrastructure/event-listeners/campaign-export-completed.listener';

// BullMQ Processor
import { CampaignExportProcessor } from './infrastructure/jobs/campaign-export.processor';

// Real adapters (external calls wrapped in the shared circuit breaker)
import { AiModule } from '../../shared/external/ai/ai.module';
import { CampaignRequestService } from './application/services/campaign-request.service';
import { GeminiStageExportGeneratorAdapter } from './infrastructure/adapters/gemini-stage-export-generator.adapter';
import { PdfKitPdfBuilderAdapter } from './infrastructure/adapters/pdfkit-pdf-builder.adapter';
import { ArchiverZipPackerAdapter } from './infrastructure/adapters/archiver-zip-packer.adapter';
import { ElevenLabsAudioGeneratorAdapter } from './infrastructure/adapters/elevenlabs-audio-generator.adapter';
import { GeminiCampaignImageGeneratorAdapter } from './infrastructure/adapters/gemini-image-generator.adapter';
import { TavilyViralityResearchAdapter } from './infrastructure/adapters/tavily-virality-research.adapter';
import { HeuristicAiDetectionAdapter } from './infrastructure/adapters/heuristic-ai-detection.adapter';

// Cross-context ACL for CompanyData (business name resolution)
import { COMPANY_DATA_LOOKUP_PORT } from './domain/ports/outbound/company-data-lookup.port';
import { PrismaCompanyDataLookupAdapter } from './infrastructure/adapters/company-data-lookup.adapter';
import { CompanyDataRepository } from '../companydata/companydata.repository';

@Module({
  imports: [
    CqrsModule,
    JwtModule.register({}),
    CacheModule,
    StorageModule,
    AiModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.CAMPAIGN_EXPORT,
    }),
  ],
  controllers: [CampaignsController],
  providers: [
    // Shared write path (used by both /export and /generate-campaign handlers)
    CampaignRequestService,

    // Command Handlers
    RequestCampaignExportHandler,
    DeleteCampaignHandler,
    BulkDeleteCampaignsHandler,
    GenerateTopicsHandler,
    GenerateCampaignHandler,

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
    ActivityLogService,
    {
      provide: AUDIT_PORT,
      useExisting: ActivityLogService,
    },

    // Cache
    CacheService,
    {
      provide: CACHE_PORT,
      useExisting: CacheService,
    },

    // WebSocket Gateway
    CampaignsGateway,
    WsJwtMiddleware,

    // Event Listeners
    CampaignExportRequestedListener,
    CampaignStageReadyListener,
    CampaignExportCompletedListener,

    // BullMQ Processor
    CampaignExportProcessor,

    // ─── Port Bindings (real adapters; external calls use cockatiel breaker) ──
    {
      provide: STAGE_EXPORT_GENERATOR_PORT,
      useClass: GeminiStageExportGeneratorAdapter,
    },
    {
      provide: PDF_BUILDER_PORT,
      useClass: PdfKitPdfBuilderAdapter,
    },
    {
      provide: ZIP_PACKER_PORT,
      useClass: ArchiverZipPackerAdapter,
    },
    {
      provide: AUDIO_GENERATOR_PORT,
      useClass: ElevenLabsAudioGeneratorAdapter,
    },
    {
      provide: IMAGE_GENERATOR_PORT,
      useClass: GeminiCampaignImageGeneratorAdapter,
    },
    {
      provide: VIRALITY_RESEARCH_PORT,
      useClass: TavilyViralityResearchAdapter,
    },
    {
      provide: AI_DETECTION_PORT,
      useClass: HeuristicAiDetectionAdapter,
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
