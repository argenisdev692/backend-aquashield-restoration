# Campaigns Module

## Architecture

This module uses **ENTERPRISE architecture (Hexagonal/DDD with CQRS opt-in)**.

### CQRS Justification

This module opts into CQRS (`@nestjs/cqrs` CommandBus/QueryBus) instead of the default UseCase pattern for the following reasons:

1. **BullMQ Job Queue Integration**: The core campaign export generation is an async operation processed by BullMQ workers. CQRS provides a clean separation between command enqueuing (GenerateCampaignHandler/RequestCampaignExportHandler) and job processing (CampaignExportProcessor), allowing the job to emit domain events and update state independently of the HTTP request lifecycle.

2. **Multi-Stage Pipeline with External Services**: The campaign generation flow involves multiple external services (Tavily virality research, Gemini stage export generation, ElevenLabs audio generation, Gemini image generation, AI detection, R2 storage, PDF generation, ZIP packing). CQRS enables future saga orchestration for compensating transactions if any external service fails.

3. **Cross-Context ACL Integration**: The module requires cross-context lookup to resolve the company name from CompanyData at request time. CQRS allows clean separation between the HTTP layer (which performs the lookup) and the domain layer (which operates on the immutable snapshot).

4. **Decoupled Read/Write Models**: The module implements separate read models for export status tracking and campaign history that are optimized for queries and don't need the full aggregate state.

### Domain Layer

- **Aggregate**: `CampaignGenerationAggregate` - Encapsulates business rules for campaign video export generation with funnel stages
- **Value Objects**: `CampaignScoresVO`, `CampaignStatusVO`, `FunnelStageVO`, `StageExportResultVO`, `VideoFormatVO`
- **Ports**: External service interfaces (ViralityResearch, StageExportGenerator, AudioGenerator, ImageGenerator, PdfBuilder, ZipPacker, AiDetection, CompanyDataLookup)
- **Events**: `CampaignExportRequestedEvent`, `CampaignStageExportReadyEvent`, `CampaignExportCompletedEvent`

### Application Layer

- **Commands**: GenerateCampaign, GenerateTopics, DeleteCampaign, BulkDeleteCampaigns, RequestCampaignExport
- **Queries**: GetCampaignExportStatus, ListMyCampaignExports, ExportCampaignExports
- **Handlers**: Command/Query handlers registered with CQRS
- **Services**: `CampaignRequestService` - Shared write path for both /export and /generate-campaign handlers

### Infrastructure Layer

- **Adapters**: Tavily (virality research), Gemini (stage export + image), ElevenLabs (audio), PDFKit (PDF), Archiver (ZIP), Heuristic (AI detection), Prisma (CompanyData lookup)
- **Persistence**: Prisma repository with mapper
- **Jobs**: BullMQ processor for async campaign export generation
- **Gateways**: WebSocket for real-time progress updates

## Flow

1. User submits campaign request (topic + funnel stages) → `GenerateCampaignCommand` or `RequestCampaignExportCommand` enqueues BullMQ job
2. `CampaignExportProcessor` executes:
   - CompanyData lookup to resolve company name (cross-context ACL)
   - Tavily virality research
   - For each funnel stage:
     - Gemini stage export generation (script, storyboard, metadata)
     - ElevenLabs audio generation (best-effort)
     - Gemini image generation (best-effort)
     - PDF generation for stage materials
   - AI detection analysis
   - R2 storage upload (analysis reports, stage exports, ZIP)
   - Transactional DB save + audit
   - Cache invalidation
   - Domain event emission per stage
3. WebSocket broadcasts progress to frontend
4. User can view campaign status, download individual stage exports, or download complete ZIP package
5. User can delete campaigns (hard delete)

## Funnel Stages

The module supports configurable funnel stages for campaign video generation:

- **Awareness**: Top-of-funnel content for brand awareness
- **Interest**: Mid-funnel content to build interest
- **Consideration**: Bottom-funnel content for decision-making
- **Conversion**: Direct response content for conversion
- **Retention**: Post-purchase content for customer retention

Each stage generates:
- Script with voiceover text
- Storyboard with visual descriptions
- Audio file (via ElevenLabs, best-effort)
- Cover image (via Gemini, best-effort)
- PDF export with stage materials

## Video Formats

The module supports two video duration formats:
- **15 seconds**: Short-form content for TikTok, Instagram Reels, YouTube Shorts
- **20 seconds**: Slightly longer short-form content

## Quality Scoring

The module implements quality scoring similar to the social-media module:

- **Virality Score**: Predicted viral potential based on Tavily research
- **ROI Score**: Predicted return on investment based on niche and target audience
- **AI Detection Score**: Human-likeness analysis (aiGenerated, aiParaphrased, humanWritten, showsAiSigns)

Scores are stored in the aggregate and included in the analysis report.

## External Services

- **Tavily**: Real-time trend research and virality scoring
- **Google Gemini**: Stage export generation (script, storyboard, metadata) and image generation
- **ElevenLabs**: Audio generation for voiceovers (best-effort)
- **Cloudflare R2**: Storage for analysis reports, stage exports, and ZIP packages
- **PDFKit**: PDF generation for stage materials
- **Archiver**: ZIP package generation
- **BullMQ**: Async job queue for long-running campaign generation

## Data Deletion Strategy

This module uses **hard delete** (no soft delete) for the following reasons:

1. **Ephemeral Campaign Data**: Campaign generations are transient export requests, not critical business records. Once the export is downloaded and used, the original generation record has limited ongoing value.

2. **Storage Costs**: Each generation includes R2-stored analysis reports, stage exports (scripts, audio, images, PDFs), and ZIP packages. Soft delete would accumulate storage costs for content that users have explicitly chosen to delete.

3. **User Privacy**: Users may want to permanently remove campaign drafts that were never published or used. Hard delete ensures complete data removal.

4. **Audit Trail**: The `audit.log` table maintains a permanent record of all deletions for compliance and debugging purposes, even though the campaign_generations row is removed.

**Note**: If future requirements indicate a need for soft delete (e.g., compliance retention policies for campaign analytics), a migration can add `deletedAt` and restore endpoints can be implemented.

## CompanyData Integration

The module integrates with the CompanyData bounded context via cross-context ACL:

- **Port**: `COMPANY_DATA_LOOKUP_PORT` with `PrismaCompanyDataLookupAdapter`
- **Purpose**: Resolve the real company name from CompanyData at request time
- **Snapshot**: The resolved company name is stored as an immutable snapshot (`companyNameSnapshot`) in the aggregate
- **Benefit**: Ensures campaign exports always reflect the company name at the time of generation, even if the company name is later changed in CompanyData

## ZIP Download

The module provides a ZIP download endpoint that generates a complete package including:

- `README.txt` - Summary with scores, metadata, and funnel stage information
- `stages/` - Individual stage exports (script, storyboard, audio, images, PDF)
- `metadata/` - Scores report, AI detection data, and research sources
- `analysis/` - Virality research and AI detection analysis reports

## Topic Generation

The module includes a topic generation feature (`GenerateTopicsCommand`) that uses Tavily research to suggest relevant campaign topics based on:
- Niche
- Location
- Target audience
- Current trends

This helps users discover high-potential campaign ideas before committing to full generation.

## WebSocket Progress Updates

Real-time progress updates are broadcast via `CampaignsGateway`:

- `campaign:progress` - Per-stage progress updates during generation
- `campaign:stage-ready` - Notification when a stage export is ready
- `campaign:completed` - Notification when the full campaign export is complete

Frontend can subscribe to these events to show real-time progress bars and stage completion status.

## Environment Variables

Required for campaign generation features:
- `GEMINI_API_KEY`: Google Gemini API key for stage export and image generation
- `TAVILY_API_KEY`: Tavily API key for virality research and topic generation
- `ELEVENLABS_API_KEY`: ElevenLabs API key for audio generation (optional, best-effort)

## Security

- All endpoints protected by `JwtAuthGuard` and `CaslGuard`
- CASL abilities: `Action.Create`, `Action.Read`, `Action.Delete` on `CAMPAIGN` subject
- Audit logging with `strict: true` on all write operations
- Hard delete with permanent audit trail
- Cross-context ACL for CompanyData lookup
- Rate limiting on generation endpoints
