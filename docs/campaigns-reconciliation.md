# Campaigns Module — Full Reconciliation Decision Record (2026-05-25)

## 1. Source Requirements
- Original user intent (first session): Full "Campaigns" module with persisted `CampaignGeneration` aggregate + Prisma, BullMQ queue for generation, WebSocket real-time progress, rate limiting, OWASP, 4 funnel stages (TOFU/MOFU/BOFU/LOYALTY), scripts + scenes + optional voice (Rachel via ElevenLabs), Tavily research grounding, Gemini for content, ZIP export + download.
- `docs/prompt-campaigns-module.md`: Detailed spec for `CampaignExportModule` → `POST /campaigns/export` that returns per-stage ZIPs (script txt, optional audio mp3 for 9:16+16:9, scenes with optional Gemini images + description, production_brief.pdf via pdfkit). Heavy in-memory ZIP with archiver, Promise.allSettled error isolation, ElevenLabs detection via fs on .env.example (to be reconciled), Gemini structured JSON for scripts/scenes/production notes.
- User confirmation (checkpoint): Persisted aggregate + Prisma, ElevenLabs optional via env, Tavily grounding, Rachel voice, rate limit + queue + WS, install necessary packages.

## 2. Project Architectural Authority (Invoked by User)
User explicitly invoked `@[/BACKEND-NEW]` workflow for this task.

Per `.windsurf/workflows/BACKEND-NEW.md`:
- **UseCase pattern** (not CQRS Command/Query handlers) for this module.
- `@Injectable()` classes with single `execute()` method in `application/use-cases/`.
- Controller injects UseCases **directly** (no CommandBus/QueryBus).
- **No** `@nestjs/cqrs` import inside the campaigns module.
- Domain: aggregates, value objects, plain-TS domain events, ports (repository + outbound).
- Infrastructure: controllers, Prisma repositories (if persisted), adapters, event listeners, gateways (WS).
- Every write UseCase **must** call `IAuditPort.log()`.

This overrides the general "CQRS for all Hex/DDD" note in some memories for this specific module because the user chose the BACKEND-NEW enterprise UseCase scaffold.

Contrast with existing modules:
- `auth/`: Uses UseCase pattern (matches BACKEND-NEW).
- `posts/`: Uses CQRS (different path taken earlier).

## 3. Key Reconciliations Made

### 3.1 Validation
- **Forbidden**: `class-validator` + decorators (`@IsString`, `@IsArray`, `@IsEnum` etc.).
- **Required**: Zod v4 + `nestjs-zod` for DTOs/schemas + auto Swagger.
- All request bodies go through `ZodValidationPipe`.

### 3.2 ElevenLabs Optionality & Detection
- **Forbidden** (per project rules): `fs.readFileSync` on `.env.example` or any .env file at runtime.
- **Required**: Use `ConfigService.get('ELEVENLABS_API_KEY')` (optional string in Zod schema). If absent or empty → treat as disabled, skip audio generation silently (no error).
- Package: `elevenlabs` (v1+). Import: `import { ElevenLabsClient } from 'elevenlabs';`
- Voice strategy: Default "Rachel" or `ELEVENLABS_VOICE_ID` env. Model: `eleven_multilingual_v2`.
- Adapter must be wrapped with `@Optional()` injection + cockatiel resilience policy.
- Stream → Buffer helper: create `src/shared/utils/stream-to-buffer.util.ts` (reusable).

### 3.3 External AI / Storage Ports
- **Reuse existing (do not duplicate)**:
  - `AI_CLIENT` (IAiClient from `src/shared/external/ai/ai-client.port.ts`) for all Gemini text + (if available) image generation.
  - `StorageService` (from `src/shared/storage/`) for all R2 uploads (ZIPs, optional images, audio if we decide to persist raw assets).
- Do **not** create new `gemini-ia.port.ts` or `r2-storage.port.ts` inside the module unless a true anti-corruption boundary is justified later.
- If Gemini image generation (for scenes) is not yet exposed on IAiClient, extend the port + Gemini adapter in shared (coordinated change) rather than forking.

### 3.4 Persistence & Aggregate
- User explicitly wants **persisted** `CampaignGeneration` aggregate.
- Prisma schema under `prisma/schema/campaigns.prisma` (or campaigns-export.prisma).
- Tables (minimum):
  - `campaign_generations` (id, userId, businessName, niche, location, phone, website?, stages[], format, durationSeconds, language, generateImages, status, createdAt, updatedAt, deletedAt?)
  - `campaign_stage_exports` (id, generationId, stage, zipKey, zipUrl, sizeBytes, error?, createdAt)
- Soft-delete friendly (withTrashed support if list endpoint exposed).
- Repository port: `ICampaignGenerationRepository` in domain/ports.
- Mapper between aggregate ↔ Prisma rows.

### 3.5 Processing Model (Heavy + Long-Running)
- `POST /campaigns/export` is a **request** operation:
  1. Validate + authorize (ownership later via CASL).
  2. Create `CampaignGeneration` in `pending` status + audit log.
  3. Enqueue BullMQ job with the payload + generationId.
  4. Return 202 Accepted { generationId, status: 'pending' } immediately.
- BullMQ processor (`campaign-export.processor.ts`) does the real work:
  - Per stage (parallel where safe, sequential for cost control): Gemini structured content (scripts for 9:16 + 16:9, 4 scenes, productionNotes).
  - Optional ElevenLabs (2 audio files per stage if enabled).
  - Optional Gemini scene images (Buffer) if `generateImages`.
  - pdfkit production_brief.pdf (one page per format, embedded images or placeholders).
  - archiver in-memory ZIP (level 9) per stage.
  - Upload each ZIP via StorageService → store keys/URLs in `campaign_stage_exports`.
  - Emit domain events: `CampaignStageExportReadyEvent`, `CampaignExportCompletedEvent`.
- Progress: WS gateway listens to events or polls processor updates → rooms `campaign:${id}` and `user:${userId}`.

### 3.6 Real-Time Notifications (WebSocket)
- Gateway: `campaigns.gateway.ts` under `infrastructure/gateways/`.
- Auth: reuse existing `WsJwtMiddleware`.
- Events emitted via `EventEmitter2` from processor / listeners.
- Listeners (infrastructure/event-listeners/): `campaign-export-ready.listener.ts`, `campaign-export-completed.listener.ts` → broadcast via gateway.
- Client can join `campaign:${generationId}` after receiving the ID from the export request.

### 3.7 Rate Limiting & OWASP
- Global ThrottlerModule already configured with multiple buckets (short/medium/long/profilePhoto).
- Export endpoint uses a dedicated tight bucket (e.g. `campaignExport` with low limit like 2-5 per minute per user) because it is extremely expensive (multiple LLM calls + TTS + images + PDF + ZIP).
- Controller: `@Throttle({ campaignExport: { limit: 3, ttl: 60_000 } })`.
- All inputs validated with Zod (OWASP #3 Injection).
- No secrets/tokens/PII in logs (structured + redaction already global).
- Safe error messages — never leak Gemini/ElevenLabs details or stack traces.
- External calls behind cockatiel (resilience module) — circuit breaker + retry + timeout.
- Audit every state mutation (`campaigns.export_requested`, `campaigns.stage_completed`, etc.) via IAuditPort in the initiating UseCase and in the processor (or via event listeners if we want audit on completion).

### 3.8 Folder Layout (Strict BACKEND-NEW + ARCHITECTURE-NEST)
```
src/modules/campaigns/
├── campaigns.module.ts
├── domain/
│   ├── entities/
│   │   └── campaign-generation.aggregate.ts
│   ├── value-objects/
│   │   ├── funnel-stage.vo.ts
│   │   ├── video-format.vo.ts
│   │   ├── export-format.vo.ts
│   │   └── stage-export-result.vo.ts
│   ├── events/
│   │   ├── campaign-export-requested.event.ts
│   │   ├── campaign-stage-ready.event.ts
│   │   └── campaign-export-completed.event.ts
│   ├── exceptions/
│   │   └── campaign-generation.exception.ts
│   └── ports/
│       ├── campaign-generation.repository.port.ts   # ICampaignGenerationRepository
│       ├── stage-export-generator.port.ts           # IStageExportGenerator (Gemini scripts+scenes)
│       ├── audio-generator.port.ts                  # IAudioGenerator (ElevenLabs @Optional)
│       ├── image-generator.port.ts                  # IImageGenerator (Gemini scenes)
│       ├── pdf-builder.port.ts
│       └── zip-packer.port.ts
├── application/
│   ├── use-cases/
│   │   ├── request-campaign-export.use-case.ts      # creates aggregate, enqueues job, audit
│   │   ├── get-campaign-export-status.use-case.ts
│   │   ├── list-my-campaign-exports.use-case.ts
│   │   └── get-export-download-links.use-case.ts    # or just return from status
│   └── dtos/                                        # Zod schemas + inferred types
│       ├── request-campaign-export.dto.ts
│       └── ...
├── infrastructure/
│   ├── api/
│   │   ├── controllers/
│   │   │   └── campaigns.controller.ts              # @UseGuards(JwtAuthGuard, CaslGuard), Zod, @Throttle, Swagger
│   │   └── presenters/
│   │       └── campaign-export.response.ts
│   ├── persistence/
│   │   ├── mappers/
│   │   │   └── campaign-generation.mapper.ts
│   │   └── repositories/
│   │       └── prisma-campaign-generation.repository.ts
│   ├── jobs/
│   │   └── campaign-export.processor.ts             # @Processor(QUEUE_NAMES.CAMPAIGN_EXPORT)
│   ├── gateways/
│   │   └── campaigns.gateway.ts
│   ├── event-listeners/
│   │   └── campaign-export-ready.listener.ts        # @OnEvent(...)
│   └── adapters/
│       ├── gemini-stage-export.adapter.ts
│       ├── elevenlabs-audio.adapter.ts              # @Optional() + ConfigService
│       ├── gemini-image.adapter.ts                  # (if separate)
│       ├── pdfkit-builder.adapter.ts
│       └── archiver-zip-packer.adapter.ts
└── __tests__/
    └── ... (later)
```

### 3.9 Queue & Shared Infrastructure
- Add `CAMPAIGN_EXPORT: 'campaign-export'` to `src/shared/messaging/queues.constants.ts`.
- Register queue in `CampaignsModule` via `BullModule.registerQueue`.
- Processor injected with the necessary ports (generator, audio @Optional, image, pdf, zip, storage, repo, cache?, eventEmitter, logger, cls).
- Processor must be resilient and idempotent where possible (check status before re-processing expensive steps).

### 3.10 Audit
- `request-campaign-export.use-case.ts` (the only write UseCase that mutates DB immediately) calls `audit.log({ action: 'campaigns.export_requested', ... })` with `strict: true`.
- Completion/side effects can emit events that a dedicated listener can audit if desired (or keep audit only on the request + final status update).

### 3.11 Module Name
- Final name: `campaigns` (directory `src/modules/campaigns/`).
- Controller prefix: `/campaigns`.
- Primary resource: export generation + history + download.

### 3.12 What We Will NOT Do
- No `fs` reads of env files at runtime.
- No `class-validator`.
- No direct Gemini SDK or ElevenLabs SDK or S3 client instantiation inside the module (always through ports/adapters or shared services).
- No pre-emptive CQRS buses in this module (follows the invoked BACKEND-NEW workflow).
- No storing raw audio/image binaries in DB (only metadata + R2 keys).

## 4. Next Steps (Following BACKEND-NEW Phases)
1. Update `env.config.ts` + `.env.example` for optional ElevenLabs keys (already partially present).
2. Extend `queues.constants.ts`.
3. Create Prisma schema (`prisma/schema/campaigns.prisma`).
4. Domain layer (VOs, aggregate with invariants, events, ports, exceptions).
5. Application UseCases + DTOs (Zod).
6. Infrastructure (Prisma repo + mapper, adapters with resilience, processor, gateway, listeners, controller with guards/throttle/Swagger).
7. Module file + registration in `AppModule`.
8. Verification against OWASP + BACKEND-NEST + ARCHITECTURE-NEST + BACKEND-NEW checklist.

## 5. Status
**Reconciliation complete.** Ready for implementation phase on user signal.

All architectural decisions above take precedence over any literal instruction in the old prompt files that would violate project standards.
