# Social Media Module

## Architecture

This module uses **ENTERPRISE architecture (Hexagonal/DDD with CQRS opt-in)**.

### CQRS Justification

This module opts into CQRS (`@nestjs/cqrs` CommandBus/QueryBus) instead of the default UseCase pattern for the following reasons:

1. **BullMQ Job Queue Integration**: The core post generation is an async operation processed by BullMQ workers. CQRS provides a clean separation between command enqueuing (GeneratePostHandler) and job processing (SocialMediaGenerationProcessor), allowing the job to emit domain events and update state independently of the HTTP request lifecycle.

2. **Future Saga Support**: The social media generation flow involves multiple external services (Tavily research, Gemini content generation, Gemini image generation, AI detection, R2 storage). CQRS enables future saga orchestration for compensating transactions if any external service fails.

3. **Decoupled Read/Write Models**: The module may eventually implement separate read models for analytics dashboards (virality trends, ROI tracking) that are optimized for queries and don't need the full aggregate state.

### Domain Layer

- **Aggregate**: `SocialMediaGenerationAggregate` - Encapsulates business rules for social media post generation
- **Value Objects**: `SocialNetworkVO` - Type-safe social network identifiers
- **Ports**: External service interfaces (TopicFinder, PostGenerator, ImageGenerator, ViralityResearch, AiDetection)
- **Events**: `SocialMediaGenerationCreatedEvent` - Emitted after successful generation

### Application Layer

- **Commands**: GeneratePost, DeleteSocialMedia, BulkDeleteSocialMedia, ExportSocialMedia, DownloadZip
- **Queries**: FindTopics, GetSocialMediaById, ListSocialMedia
- **Handlers**: Command/Query handlers registered with CQRS

### Infrastructure Layer

- **Adapters**: Tavily (research), Gemini (content/image), Stub (AI detection)
- **Persistence**: Prisma repository with mapper
- **Jobs**: BullMQ processor for async generation
- **Gateways**: WebSocket for real-time progress updates

## Flow

1. User submits topic → `GeneratePostCommand` enqueues BullMQ job
2. `SocialMediaGenerationProcessor` executes:
   - Tavily virality research
   - Quality loop (max 5 iterations) with AI content generation
   - AI detection analysis
   - Gemini image generation (best-effort)
   - R2 storage upload
   - Transactional DB save + audit
   - Cache invalidation
   - Domain event emission
3. WebSocket broadcasts progress to frontend
4. User can view/download generated content
5. User can download complete ZIP package with content, images, and metadata

## Quality Loop with Auto-Regeneration

The module implements a quality loop with auto-regeneration as documented in the AI MODULES prompt:

- **Max Iterations**: 5 attempts per generation
- **Score Thresholds**:
  - Human Writing Index ≥ 75 (critical - blocks publication if below)
  - Virality Score ≥ 70
  - Engagement Score ≥ 70
  - ROI Score ≥ 70
  - Trend Alignment ≥ 70
- **Feedback Loop**: If scores don't pass thresholds, the system identifies weaknesses and provides specific feedback to the AI generator for the next iteration
- **Best Attempt Tracking**: The system always keeps the best attempt across all iterations
- **Quality Warning**: If max iterations reached without all scores passing, the system saves the best attempt with `qualityWarning: true` for manual review

## External Services

- **Tavily**: Real-time trend research and virality scoring
- **Google Gemini**: Content generation and image generation
- **Cloudflare R2**: Storage for images, analysis reports, and history JSON
- **BullMQ**: Async job queue for long-running generation

## Data Deletion Strategy

This module uses **hard delete** (no soft delete) for the following reasons:

1. **Ephemeral Content**: Social media generations are transient content drafts, not critical business records. Once a post is published to social platforms, the original generation record has limited ongoing value.

2. **Storage Costs**: Each generation includes R2-stored images, analysis reports, and history JSON. Soft delete would accumulate storage costs for content that users have explicitly chosen to delete.

3. **User Privacy**: Users may want to permanently remove draft content that was never published. Hard delete ensures complete data removal.

4. **Audit Trail**: The `audit.log` table maintains a permanent record of all deletions for compliance and debugging purposes, even though the social_media_generations row is removed.

**Note**: If future requirements indicate a need for soft delete (e.g., compliance retention policies), a migration can add `deletedAt` and restore endpoints can be implemented.

## Scheduled Publication

Scheduled publication (cronjob) is documented in the AI MODULES prompt but is **not implemented** in the current version. This is an optional feature that can be added if business requirements specify:

- Need to schedule posts for future publication
- Integration with social platform APIs for scheduled posting
- Automated publishing workflows

To implement scheduled publication:
1. Add `scheduledAt` column to Prisma schema
2. Create a cronjob service using `@nestjs/schedule`
3. When `scheduledAt` arrives, change status to `published` and invalidate cache
4. Optionally emit WebSocket notification to user

## ZIP Download

The module provides a ZIP download endpoint (`POST /api/social-media/:id/download-zip`) that generates a complete package including:

- `README.txt` - Summary with scores and metadata
- `content/` - Platform-specific post text files
- `images/` - Cover images for each platform (if available)
- `metadata/` - Scores report, AI detection data, and research sources
