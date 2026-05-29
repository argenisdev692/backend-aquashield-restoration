# Posts Module

## Architecture

This module uses **ENTERPRISE architecture (Hexagonal/DDD + CQRS)** with CommandBus/QueryBus pattern instead of the default UseCase pattern.

### CQRS Justification

The Posts module opts into CQRS (`@nestjs/cqrs`) instead of the default UseCase pattern due to the following complexity requirements:

1. **AI Integration Complexity**: 
   - Dual external AI services integration (Tavily for research, Gemini for content generation)
   - Complex AI generation pipeline with quality scoring and iteration logic
   - Port/Adapter pattern for AI services (`AI_POST_GENERATION_PORT`, `RESEARCH_PORT`)

2. **Asynchronous Processing**:
   - BullMQ job queue for AI post generation (`AiPostGenerationProcessor`)
   - WebSocket gateway for real-time generation updates (`PostsGateway`)
   - Scheduler for scheduled post publishing (`PostScheduler`)

3. **Multiple Handlers**:
   - 6 command handlers (Create, Update, Delete, Restore, BulkDelete, BulkRestore, GeneratePreview)
   - 3 query handlers (GetById, GetList, Export)
   - Decoupled write/read models for scalability

4. **Domain Events for Cross-Context Coordination**:
   - Events: `post-created`, `post-deleted`, `post-restored`, `posts-bulk-deleted`, `posts-bulk-restored`
   - Event listeners in `infrastructure/event-listeners/` for side effects
   - Enables future integration with notification systems, analytics, or other bounded contexts

5. **Complex Business Logic**:
   - Post scheduling with time validation (minimum 24 hours in future)
   - Content sanitization (OWASP compliance) for both manual and AI-generated content
   - Soft-delete with visibility controls (`withTrashed`, `onlyTrashed`)

Without CQRS, coordinating these concerns within a single UseCase would violate single responsibility and make the codebase difficult to maintain.

## Module Structure

```
posts/
├── domain/
│   ├── entities/
│   │   └── post.aggregate.ts          # Aggregate root with business invariants
│   ├── value-objects/
│   │   ├── post-id.vo.ts
│   │   └── generated-post-preview.vo.ts
│   ├── events/
│   │   ├── post-created.domain-event.ts
│   │   ├── post-deleted.domain-event.ts
│   │   ├── post-restored.domain-event.ts
│   │   ├── post-updated.domain-event.ts
│   │   ├── posts-bulk-deleted.domain-event.ts
│   │   └── posts-bulk-restored.domain-event.ts
│   ├── ports/
│   │   ├── ai-post-generation.port.ts
│   │   └── research.port.ts
│   ├── repositories/
│   │   └── post-repository.interface.ts
│   └── exceptions/
│       ├── invalid-post-id.exception.ts
│       └── post-domain.exception.ts
├── application/
│   ├── commands/
│   │   ├── handlers/
│   │   │   ├── create-post.handler.ts
│   │   │   ├── update-post.handler.ts
│   │   │   ├── delete-post.handler.ts
│   │   │   ├── restore-post.handler.ts
│   │   │   ├── bulk-delete-posts.handler.ts
│   │   │   ├── bulk-restore-posts.handler.ts
│   │   │   └── generate-post-preview.handler.ts
│   │   ├── create-post.command.ts
│   │   ├── update-post.command.ts
│   │   ├── delete-post.command.ts
│   │   ├── restore-post.command.ts
│   │   ├── bulk-delete-posts.command.ts
│   │   ├── bulk-restore-posts.command.ts
│   │   └── generate-post-preview.command.ts
│   ├── queries/
│   │   ├── handlers/
│   │   │   ├── get-post-by-id.handler.ts
│   │   │   ├── get-posts-list.handler.ts
│   │   │   └── export-posts.handler.ts
│   │   ├── get-post-by-id.query.ts
│   │   ├── get-posts-list.query.ts
│   │   └── export-posts.query.ts
│   ├── dtos/
│   │   ├── create-post.dto.ts
│   │   ├── update-post.dto.ts
│   │   ├── post-filters.dto.ts
│   │   ├── export-posts.dto.ts
│   │   ├── bulk-ids.dto.ts
│   │   ├── generate-post-preview.dto.ts
│   │   ├── generate-social-post-ideas.dto.ts
│   │   └── generate-social-post.dto.ts
│   └── posts-cache.constants.ts
├── infrastructure/
│   ├── api/
│   │   ├── controllers/
│   │   │   └── posts.controller.ts
│   │   └── presenters/
│   │       ├── post.response.ts
│   │       ├── post-list.response.ts
│   │       ├── create-post.response.ts
│   │       └── generate-post-preview.response.ts
│   ├── persistence/
│   │   ├── repositories/
│   │   │   └── prisma-post.repository.ts
│   │   └── mappers/
│   │       └── post.mapper.ts
│   ├── external/
│   │   ├── ai/
│   │   │   └── gemini-post-generation.adapter.ts
│   │   └── tavily/
│   │       └── tavily-research.adapter.ts
│   ├── event-listeners/
│   │   └── post-event.listener.ts
│   ├── gateways/
│   │   └── posts.gateway.ts
│   ├── jobs/
│   │   └── ai-post-generation.processor.ts
│   └── scheduler/
│       └── post.scheduler.ts
├── posts.module.ts
└── __tests__/
    ├── application/
    │   ├── commands/
    │   └── queries/
    └── domain/
        └── post.aggregate.spec.ts
```

## Key Features

### AI-Assisted Content Generation

- **POST /api/posts/ai/generate-preview**: Generates blog post content with AI
  - Calls Tavily for fresh research (E-E-A-T grounding)
  - Generates article with Gemini using E-E-A-T writing rules
  - Generates SEO metadata (slug, excerpt, meta tags)
  - Optionally generates and uploads hero image to R2
  - Rate limited: 5 requests per 60 seconds

### Manual + AI Hybrid Creation

- **POST /api/posts**: Supports both manual and AI-assisted creation
  - Manual: Client provides full `postContent` + SEO fields
  - AI-assisted: Set `generateWithAi: true` with just `postTitle`
  - Client values always override AI-generated values

### Soft-Delete with Visibility Controls

- List/get/export routes support `?withTrashed=true` and `?onlyTrashed=true`
- `onlyTrashed` requires `Action.Restore` permission
- Repository uses `TrashedMode` enum ('exclude' | 'include' | 'only')

### Bulk Operations

- **POST /api/posts/bulk-delete**: Soft-delete multiple posts in one transaction
- **POST /api/posts/bulk-restore**: Restore multiple posts in one transaction
- Single `updateMany`/`deleteMany` call per operation (no loops)
- One audit row per bulk operation with `ids[]` and `count` in metadata
- One domain event per bulk operation

### Exports

- **GET /api/posts/export**: Export posts to CSV, XLSX, or PDF
- Supports all filter options including soft-delete visibility
- Rate limited via `@Throttle()` decorator

### Social Media Post Generation (2-step quality-loop flow)

Implements the flow in `docs/AI-MODULES/POSTS/prompt-social-media-post-generator-v2.md`.

- **POST /api/posts/social/generate-ideas** — `GenerateSocialIdeasHandler`. One Tavily
  research call + Gemini → niche analysis + 10 scored ideas. Cached (1h) by a stable
  key; fire-and-forget audit (`posts.social_ideas_generated`). Rate limited 10/min.
- **POST /api/posts/social/generate-post** — `GenerateSocialPostHandler` enqueues onto
  the `SOCIAL_MEDIA_GENERATION` BullMQ queue and blocks on `waitUntilFinished`.
  `SocialPostGenerationProcessor` runs the quality loop:
  1. Rotating Tavily queries per iteration (fresh grounding).
  2. Gemini generates a full multi-platform package + 5 scores.
  3. `evaluateScores` checks thresholds — Human Writing Index ≥ 75 (critical),
     EEAT / Virality / ROI / SEO ≥ 70. If any fail, feed the weaknesses back and
     regenerate. Max 5 iterations; keep the best attempt and flag `quality_warning`.
  4. Best-effort Gemini Imagen covers → R2 (`social-media/posts/{uuid}/…`), uploaded
     BEFORE the DB tx; orphan blobs cleaned up on tx failure.
  5. Persist `SocialMediaGeneration` (tx + strict audit `posts.social_generated`),
     cache the result (24h), broadcast `post:social:completed` over WebSocket. Per-
     iteration progress is streamed via `post:social:progress`.
  Rate limited 5/min.
- **POST /api/posts/social/:id/download-zip** — `DownloadSocialZipHandler`. Owner-only
  ZIP (content/, seo/, metadata/, images/, README) built with `archiver`. `@SkipCache()`,
  audited `posts.social_exported`.

> **Frontend note:** `post-creator-v2.jsx` currently calls `POST /api/posts/download-zip`
> with the whole result in the body. Update it to `POST /api/posts/social/${result.id}/download-zip`
> (the backend persists the generation and returns its `id`). The response also exposes a
> `human_likeness_score` alias of `human_writing_index` so the existing score rings render
> unchanged.

## Dependencies

- `@nestjs/cqrs`: CQRS pattern implementation
- `@nestjs/bullmq`: Job queue for async AI generation
- `@nestjs/websockets`: WebSocket gateway for real-time updates
- `@nestjs/schedule`: Scheduler for scheduled posts
- `@nestjs/event-emitter`: Domain event publishing
- `@nestjs-cls/transactional`: Transactional decorator
- `@nestjs/cache-manager`: Cache invalidation
- `@nestjs/throttler`: Rate limiting

## Environment Variables

Required for AI features:
- `GEMINI_API_KEY`: Google Gemini API key for content generation
- `TAVILY_API_KEY`: Tavily API key for web research

## Security

- All endpoints protected by `JwtAuthGuard` and `CaslGuard`
- CASL abilities: `Action.Create`, `Action.Read`, `Action.Update`, `Action.Delete`, `Action.Restore` on `CONTENT` subject
- Content sanitization via `sanitizeRichContent` and `sanitizePlainText` (OWASP compliance)
- Rate limiting on AI generation endpoints
- Audit logging with `strict: true` on all write operations
- Soft-delete visibility gated by `Action.Restore` permission
