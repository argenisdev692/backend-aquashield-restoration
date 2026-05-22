---
description: Directory structure of each NestJS service — Hexagonal / DDD + CQRS (CommandBus/QueryBus). Use for complex bounded contexts with real business rules, events, workflows, or cross-context coordination. For simple CRUD modules, start with `.windsurf/skills/ARCHITECTURE-NEST-CRUD/SKILL.md`. For coding rules, naming, testing, logging, cache, and exports → see `.windsurf/skills/BACKEND-NEST/SKILL.md`.
globs: src/**
---

# ARCHITECTURE-NEST — Directory Structure (2026)

> **Authority**: SINGLE SOURCE OF TRUTH for all file placement and module structure.
> **Pattern**: Hexagonal Architecture + DDD + CQRS — Commands/Queries dispatched via `@nestjs/cqrs` `CommandBus`/`QueryBus`, Port/Adapter, Domain Events via EventEmitter2.
> **When to use this**: only when the module has complex business rules, domain events, ACL, or cross-context coordination.
> **Default for small features**: use `.windsurf/skills/ARCHITECTURE-NEST-CRUD/SKILL.md` first; escalate here only when the simpler structure is no longer enough.
> **For coding rules, naming conventions, testing strategy, logging, cache, exports → see `.windsurf/skills/BACKEND-NEST/SKILL.md`.**

---

## 📁 Full Service Structure

```
src/
├── app.module.ts                   # Root module: imports CoreModule, SharedModule, feature modules
├── main.ts                         # Bootstrap: HTTP + WebSocket
├── instrumentation.ts              # OpenTelemetry SDK init — MUST be first import in main.ts
│
├── core/                           # 🟢 Cross-cutting concerns — NO business logic
│   ├── decorators/
│   │   ├── roles.decorator.ts            # @Roles('admin', 'superadmin')
│   │   ├── current-user.decorator.ts     # @CurrentUser() extracts JWT claims
│   │   ├── policy.decorator.ts           # @Policy({ action, resource, ownerField }) — ownership rule
│   │   ├── transactional.decorator.ts    # @Transactional() wraps Prisma TX via nestjs-cls
│   │   ├── skip-audit.decorator.ts       # @SkipAudit() disables AuditInterceptor on a route
│   │   └── skip-cache.decorator.ts       # @SkipCache() bypasses CacheTTLInterceptor on a route
│   │
│   ├── filters/
│   │   └── global-exception.filter.ts    # HTTP errors → RFC 7807 Problem Details
│   │
│   ├── interceptors/
│   │   ├── timeout.interceptor.ts        # Configurable timeout per route
│   │   ├── serialize.interceptor.ts      # Strips fields not declared in the Zod `Response` presenter — never uses class-transformer
│   │   ├── transaction.interceptor.ts    # Prisma transaction per request
│   │   ├── logging.interceptor.ts        # Logs every HTTP request/response with traceId
│   │   ├── audit.interceptor.ts          # Auto-logs POST/PATCH/PUT/DELETE via IAuditPort
│   │   └── cache-ttl.interceptor.ts      # Reads @CacheTTL() on handler, caches GET responses
│   │
│   ├── guards/
│   │   ├── jwt-auth.guard.ts             # Level 1 — Verifies JWT on HTTP requests + WS handshake
│   │   └── casl.guard.ts                 # Level 2 — CASL ability check via @CheckAbilities()
│   │
│   ├── pipes/
│   │   └── zod-validation.pipe.ts        # Validates all DTOs with Zod v4 — replaces class-validator
│   │
│   ├── resilience/
│   │   ├── circuit-breaker.service.ts    # Cockatiel: CB + retry + bulkhead + timeout
│   │   ├── circuit-breaker.decorator.ts  # @CircuitBreaker('service-name')
│   │   └── resilience.module.ts
│   │
│   └── health/
│       ├── health.controller.ts          # GET /health — @nestjs/terminus checks all deps
│       └── health.module.ts
│
├── shared/                         # 🟡 Shared infrastructure — importable by any module
│   │                               # NEVER imports from modules/ (prevents circular deps)
│   ├── database/
│   │   ├── database.module.ts            # @Global() — registers PrismaService for all modules
│   │   ├── prisma.service.ts             # extends PrismaClient (output: src/generated/prisma)
│   │   │                                 # + onModuleInit/$connect, onModuleDestroy/$disconnect
│   │   │                                 # + constructor passes `new PrismaPg({ connectionString })`
│   │   └── transactions/                 # @nestjs-cls/transactional Prisma adapter (optional)
│   │
│   ├── cache/
│   │   ├── cache.module.ts               # @Global() — ioredis-backed CacheService (NOT @nestjs/cache-manager)
│   │   ├── cache.service.ts              # Concrete facade — get/set/del/delByPattern (SCAN, never KEYS)
│   │   ├── cache.port.ts                 # ICachePort + CACHE_PORT Symbol — the Hex/DDD application boundary
│   │   └── cache-ttl.constants.ts        # TTL_SECONDS: SHORT | MEDIUM | LONG | STATIC
│   │
│   ├── export/                           # 🟢 Reports — usable from ANY module (CRUD or Hex/DDD)
│   │   ├── export.module.ts              # Registers ExcelJS + PDFKit adapters
│   │   ├── export.service.ts             # Orchestrator: routes to adapter by format (xlsx | pdf)
│   │   ├── ports/
│   │   │   ├── excel-exporter.port.ts    # IExcelExporter
│   │   │   └── pdf-exporter.port.ts      # IPdfExporter
│   │   ├── adapters/
│   │   │   ├── exceljs.adapter.ts        # IExcelExporter via ExcelJS (only Excel engine — never `xlsx`)
│   │   │   └── pdfkit.adapter.ts         # IPdfExporter via PDFKit — only PDF engine (Puppeteer NOT used)
│   │   ├── decorators/
│   │   │   └── export-column.decorator.ts # @ExportColumn({ label, format }) on ReadModel fields
│   │   └── export.constants.ts           # FORMAT enum: XLSX | PDF
│   │
│   ├── messaging/
│   │   ├── queue.module.ts               # BullMQ jobs configuration
│   │   └── queues.constants.ts           # QUEUE_NAMES enum
│   │
│   ├── external/                         # 🟢 Outbound integrations — all wrapped with cockatiel CB
│   │   ├── http-client.service.ts        # Base undici client: timeout + retry + traceId propagation
│   │   ├── http-client.module.ts         # @Global — provides HttpClientService
│   │   │
│   │   ├── ai/                           # AI providers — used by any module that needs LLM/embeddings
│   │   │   ├── ai.module.ts              # Binds IAiClient to selected provider via env
│   │   │   ├── ai-client.port.ts         # IAiClient: chat(), complete(), embed(), stream()
│   │   │   ├── openai.adapter.ts         # @CircuitBreaker('openai')  — Responses API
│   │   │   ├── anthropic.adapter.ts      # @CircuitBreaker('anthropic') — Messages API
│   │   │   └── ai.constants.ts           # MODELS, default timeouts (30s), max retries (2)
│   │   │
│   │   └── fastapi/                      # Internal Python services
│   │       ├── fastapi.module.ts         # @Global — provides IFastapiClient
│   │       ├── fastapi-client.port.ts    # IFastapiClient: get<T>(), post<T,B>()
│   │       └── fastapi-client.adapter.ts # @CircuitBreaker('fastapi') — base URL from env
│   │
│   ├── websockets/
│   │   ├── ws-jwt.middleware.ts          # WS handshake JWT validation
│   │   ├── redis-io.adapter.ts           # Socket.io Redis Adapter for multi-pod deployments
│   │   └── ws-rooms.service.ts           # Room join/leave/broadcast helpers
│   │
│   ├── activity-log/
│   │   ├── activity-log.module.ts        # Provides ActivityLogService as IAuditPort binding
│   │   ├── activity-log.service.ts       # IAuditPort implementation — inserts into activity_logs
│   │   ├── activity-log.prisma           # Prisma model `ActivityLog` (APPEND-ONLY) — copy under prisma/schema/
│   │   ├── activity-log-query.service.ts # Read-only queries for audit UI
│   │   └── activity-log.dto.ts           # AuditLogEntry type definition
│   │
│   ├── backup/
│   │   ├── backup.module.ts
│   │   ├── backup.service.ts             # Orchestrates pg_dump → checksum → S3 upload
│   │   ├── backup.scheduler.ts           # @Cron: daily full + 4h incremental
│   │   ├── backup-storage.port.ts        # IBackupStoragePort interface
│   │   ├── s3-backup-storage.adapter.ts  # AWS S3 / Cloudflare R2 implementation
│   │   └── backup-restore.service.ts     # Restore from snapshot by backupId
│   │
│   └── config/
│       └── env.config.ts                 # Zod v4 schema — validates ALL env vars at bootstrap
│
├── logger/                         # 🆕 Structured logging — global module
│   ├── logger.module.ts                  # Global — auto-imported by AppModule
│   ├── logger.service.ts                 # Pino wrapper: log/info/warn/error/debug
│   ├── logger.context.ts                 # LogContext type: traceId, correlationId, service, layer, durationMs
│   ├── pino.config.ts                    # Pino options: pretty in dev, JSON in prod, redact list
│   └── log-redact.constants.ts           # Redact: password, token, secret, authorization, cookie
│
└── modules/                        # 🔴 Bounded Contexts — see sections below
    ├── users/
    ├── auth/
    ├── profile/
    └── {YourModule}/
```

---

## 🧩 Bounded Context Template — `{YourModule}/`

> Every new bounded context follows this exact structure.
> Replace `{Module}` / `{module}` with the actual name (e.g. `projects`, `estimates`, `contractors`).
> **CQRS**: Write operations use `CommandBus` → `@CommandHandler`. Read operations use `QueryBus` → `@QueryHandler`.

```
modules/{module}/
├── {module}.module.ts              # CqrsModule import + Handlers + port Symbol bindings
│
├── __tests__/
│   ├── domain/
│   │   └── {module}.aggregate.spec.ts          # Pure unit — zero NestJS/Prisma
│   └── application/
│       ├── commands/
│       │   ├── create-{module}.handler.spec.ts
│       │   ├── update-{module}.handler.spec.ts
│       │   └── delete-{module}.handler.spec.ts
│       └── queries/
│           ├── get-{module}-by-id.handler.spec.ts
│           └── get-{module}-list.handler.spec.ts
│
├── domain/                         # 🔵 ZERO NestJS / infra dependencies
│   ├── entities/
│   │   └── {module}.aggregate.ts
│   ├── value-objects/
│   │   └── *.vo.ts
│   ├── exceptions/
│   │   └── {module}-domain.exception.ts
│   ├── events/
│   │   └── {module}-created.domain-event.ts  # Plain TS class — no @nestjs/cqrs IEvent
│   └── ports/
│       ├── {module}.repository.interface.ts  # I{Module}Repository (outbound port)
│       ├── audit.port.interface.ts           # IAuditPort (re-used from shared)
│       └── notification.port.interface.ts    # INotificationPort (if needed)
│
├── application/                    # 🟡 Orchestration only — no infra imports
│   ├── commands/                             # Command payloads (plain TS) live here; handlers go in handlers/
│   │   ├── create-{module}.command.ts
│   │   ├── update-{module}.command.ts
│   │   ├── delete-{module}.command.ts
│   │   ├── restore-{module}.command.ts            # only when soft delete is enabled
│   │   ├── bulk-delete-{module}.command.ts        # multi-select delete
│   │   ├── bulk-restore-{module}.command.ts       # multi-select restore (soft delete only)
│   │   ├── export-{module}.command.ts
│   │   └── handlers/                              # @CommandHandler — write logic lives here
│   │       ├── create-{module}.handler.ts
│   │       ├── update-{module}.handler.ts
│   │       ├── delete-{module}.handler.ts
│   │       ├── restore-{module}.handler.ts
│   │       ├── bulk-delete-{module}.handler.ts    # ONE audit row, ONE cache flush, ONE event
│   │       ├── bulk-restore-{module}.handler.ts   # ONE audit row, ONE cache flush, ONE event
│   │       └── export-{module}.handler.ts         # IAuditPort.log() + @SkipCache() on controller
│   │
│   ├── queries/                              # Query payloads live here; handlers go in handlers/
│   │   ├── get-{module}-by-id.query.ts
│   │   ├── get-{module}-list.query.ts
│   │   └── handlers/                              # @QueryHandler — read logic lives here
│   │       ├── get-{module}-by-id.handler.ts
│   │       └── get-{module}-list.handler.ts
│   │
│   ├── dtos/
│   │   ├── create-{module}.dto.ts            # Zod schema + z.infer<>
│   │   └── update-{module}.dto.ts
│   └── read-models/
│       └── {module}.read-model.ts            # Fields with @ExportColumn where applicable
│
└── infrastructure/                 # 🔴 NestJS + infra imports allowed here ONLY
    ├── persistence/
    │   ├── {module}.prisma                   # Prisma model — copy under `prisma/schema/`
    │   ├── mappers/
    │   │   └── {module}.mapper.ts            # Aggregate ↔ PrismaRow ↔ ReadModel
    │   └── repositories/
    │       └── prisma-{module}.repository.ts # Implements I{Module}Repository
    │
    ├── api/
    │   ├── controllers/
    │   │   └── {module}.controller.ts        # REST: dispatches via CommandBus / QueryBus
    │   └── presenters/
    │       ├── {module}.response.ts
    │       └── {module}-list.response.ts
    │
    ├── jobs/
    │   └── {module}-{job-name}.processor.ts  # @Processor(QUEUE_NAMES.X) — BullMQ job handler
    │
    ├── gateways/
    │   └── {module}.gateway.ts               # Socket.io — emits domain events to WS rooms
    │
    ├── event-listeners/
    │   └── {module}-created.listener.ts      # @OnEvent('{module}.created') — side effects
    │
    ├── acl/
    │   └── {context}.mapper.ts               # Anti-Corruption Layer: external DTO → domain VO
    │
    └── external-services/
        └── {service}-{tech}.adapter.ts       # e.g. sendgrid-email.adapter.ts
```

---

## 🧠 `aggregate.ts` ↔ `entity.ts` mapping (read this)

`domain/entities/{module}.aggregate.ts` is the **rich-domain counterpart** of the flat-CRUD `{module}.entity.ts` (see `.windsurf/skills/ARCHITECTURE-NEST-CRUD/SKILL.md`). It is **not** a plain data interface: it is a class with private state, a static factory `create()`, behavior methods, and invariants enforced together with `domain/value-objects/*.vo.ts`. The data-shape concerns that CRUD packs into one `entity.ts` are split here across four files:

| Concern | Flat CRUD (simple) | This layout (Hex/DDD full) |
|---|---|---|
| Domain object | `{module}.entity.ts` (interface) | `domain/entities/{module}.aggregate.ts` (class + invariants) |
| Invariants / rules | in the Service | in the Aggregate + `value-objects/*.vo.ts` |
| Read shape | same entity | `application/read-models/{module}.read-model.ts` |
| DB ↔ domain | inline in repository | `infrastructure/persistence/mappers/{module}.mapper.ts` |
| HTTP response | `dto/{module}.response.ts` | `infrastructure/api/presenters/{module}.response.ts` |

Same concept, two names by tier — the rename is **deliberate**, not a simplification: `entity.ts` signals "anemic data, logic in Service"; `aggregate.ts` signals "rich domain, logic inside". An aggregate with no invariants is an anemic-domain-model anti-pattern — if a module has none, it belongs in the flat CRUD layout, not here.

---

## 🧩 Bounded Context: users/

> CRUD for user entities. Does NOT own login, OTP, reset password, or profile update.

```
modules/users/
├── users.module.ts                            # imports CqrsModule, registers handlers
├── __tests__/
│   ├── domain/
│   │   ├── user.aggregate.spec.ts
│   │   └── email.value-object.spec.ts
│   └── application/
│       ├── commands/
│       │   ├── create-user.handler.spec.ts
│       │   ├── suspend-user.handler.spec.ts
│       │   └── export-users.handler.spec.ts
│       └── queries/
│           ├── get-user-by-id.handler.spec.ts
│           └── get-users-list.handler.spec.ts
│
├── domain/
│   ├── entities/
│   │   └── user.aggregate.ts
│   ├── value-objects/
│   │   ├── email.vo.ts
│   │   ├── password.vo.ts
│   │   └── user-id.vo.ts
│   ├── events/
│   │   ├── user-created.domain-event.ts
│   │   ├── user-suspended.domain-event.ts
│   │   └── password-changed.domain-event.ts
│   ├── services/
│   │   └── password-hasher.service.ts
│   └── ports/
│       ├── user.repository.interface.ts       # IUserRepository
│       ├── email.service.interface.ts         # IEmailService
│       └── audit.port.interface.ts            # IAuditPort
│
├── application/
│   ├── commands/
│   │   ├── create-user.command.ts
│   │   ├── update-user.command.ts
│   │   ├── delete-user.command.ts                  # soft delete
│   │   ├── restore-user.command.ts
│   │   ├── bulk-delete-users.command.ts
│   │   ├── bulk-restore-users.command.ts
│   │   ├── suspend-user.command.ts
│   │   ├── change-password.command.ts
│   │   ├── export-users.command.ts
│   │   └── handlers/
│   │       ├── create-user.handler.ts              # logs 'users.created'
│   │       ├── update-user.handler.ts              # logs 'users.updated'
│   │       ├── delete-user.handler.ts              # logs 'users.deleted'
│   │       ├── restore-user.handler.ts             # logs 'users.restored'
│   │       ├── bulk-delete-users.handler.ts        # logs 'users.bulk_deleted' (ids[] in metadata)
│   │       ├── bulk-restore-users.handler.ts       # logs 'users.bulk_restored' (ids[] in metadata)
│   │       ├── suspend-user.handler.ts             # logs 'users.suspended'
│   │       ├── change-password.handler.ts          # logs 'users.password_changed'
│   │       └── export-users.handler.ts             # logs 'users.export'
│   │
│   ├── queries/
│   │   ├── get-user-by-id.query.ts
│   │   ├── get-users-list.query.ts
│   │   └── handlers/
│   │       ├── get-user-by-id.handler.ts
│   │       └── get-users-list.handler.ts
│   │
│   ├── dtos/
│   │   ├── create-user.dto.ts
│   │   └── update-user.dto.ts
│   └── read-models/
│       └── user.read-model.ts
│
└── infrastructure/
    ├── persistence/
    │   ├── users.prisma                      # → mirrored in prisma/schema/users.prisma
    │   ├── mappers/
    │   │   └── user.mapper.ts
    │   └── repositories/
    │       └── prisma-user.repository.ts
    ├── api/
    │   ├── controllers/
    │   │   └── users.controller.ts            # CommandBus/QueryBus + GET /users/export
    │   └── presenters/
    │       ├── user.response.ts
    │       └── user-list.response.ts
    ├── gateways/
    │   └── user.gateway.ts                    # Socket.io WS
    ├── event-listeners/
    │   └── user-created.listener.ts           # @OnEvent('user.created')
    ├── acl/
    │   └── rbac-role.mapper.ts                # RbacRoleDto → UserRole VO
    └── external-services/
        └── sendgrid-email.adapter.ts          # IEmailService implementation
```

---

## 🧩 Bounded Context: auth/

> Owns all authentication flows. Communicates with `users/` only via ACL.

```
modules/auth/
├── auth.module.ts                             # imports CqrsModule, registers handlers
├── __tests__/
│   ├── domain/
│   │   ├── otp.aggregate.spec.ts
│   │   └── auth-session.aggregate.spec.ts
│   └── application/
│       ├── commands/
│       │   ├── login.handler.spec.ts
│       │   ├── verify-otp.handler.spec.ts
│       │   └── refresh-token.handler.spec.ts
│       └── queries/
│           └── get-active-sessions.handler.spec.ts
│
├── domain/
│   ├── entities/
│   │   ├── auth-session.aggregate.ts
│   │   └── otp.aggregate.ts
│   ├── value-objects/
│   │   ├── access-token.vo.ts
│   │   ├── refresh-token.vo.ts
│   │   ├── otp-code.vo.ts
│   │   ├── reset-token.vo.ts
│   │   └── device-info.vo.ts
│   ├── events/
│   │   ├── user-logged-in.domain-event.ts
│   │   ├── user-logged-out.domain-event.ts
│   │   ├── otp-verified.domain-event.ts
│   │   ├── password-reset.domain-event.ts
│   │   └── two-fa-enabled.domain-event.ts
│   ├── services/
│   │   ├── token-generator.service.ts
│   │   ├── otp-generator.service.ts
│   │   └── password-reset-token.service.ts
│   └── ports/
│       ├── auth-session.repository.interface.ts
│       ├── otp.repository.interface.ts
│       ├── audit.port.interface.ts
│       ├── notification.port.interface.ts
│       └── user-lookup.port.interface.ts      # ACL to users context
│
├── application/
│   ├── commands/
│   │   ├── login.command.ts
│   │   ├── logout.command.ts
│   │   ├── logout-all-sessions.command.ts
│   │   ├── refresh-token.command.ts
│   │   ├── request-otp.command.ts
│   │   ├── verify-otp.command.ts
│   │   ├── request-password-reset.command.ts
│   │   ├── reset-password.command.ts
│   │   ├── enable-2fa.command.ts
│   │   ├── confirm-2fa.command.ts
│   │   ├── disable-2fa.command.ts
│   │   └── handlers/
│   │       ├── login.handler.ts                   # logs 'auth.login'
│   │       ├── logout.handler.ts                  # logs 'auth.logout'
│   │       ├── logout-all-sessions.handler.ts     # logs 'auth.logout_all'
│   │       ├── refresh-token.handler.ts           # logs 'auth.token_refreshed'
│   │       ├── request-otp.handler.ts             # logs 'auth.otp_requested'
│   │       ├── verify-otp.handler.ts              # logs 'auth.otp_verified' or 'auth.otp_failed'
│   │       ├── request-password-reset.handler.ts  # always HTTP 200 — no email enumeration
│   │       ├── reset-password.handler.ts          # logs 'auth.password_reset'
│   │       ├── enable-2fa.handler.ts              # logs 'auth.2fa_initiated'
│   │       ├── confirm-2fa.handler.ts             # logs 'auth.2fa_enabled'
│   │       └── disable-2fa.handler.ts             # logs 'auth.2fa_disabled'
│   │
│   ├── queries/
│   │   ├── get-active-sessions.query.ts
│   │   └── handlers/
│   │       └── get-active-sessions.handler.ts
│   │
│   ├── dtos/
│   │   ├── login.dto.ts
│   │   ├── request-otp.dto.ts
│   │   ├── verify-otp.dto.ts
│   │   ├── request-password-reset.dto.ts
│   │   ├── reset-password.dto.ts
│   │   └── verify-reset-token.dto.ts
│   └── read-models/
│       └── auth-session.read-model.ts
│
└── infrastructure/
    ├── persistence/
    │   ├── schemas/
    │   │   ├── auth-session.prisma           # → mirrored in prisma/schema/auth.prisma
    │   │   ├── otp.prisma
    │   │   └── password-reset-token.prisma
    │   ├── mappers/
    │   │   ├── auth-session.mapper.ts
    │   │   └── otp.mapper.ts
    │   └── repositories/
    │       ├── prisma-auth-session.repository.ts
    │       └── prisma-otp.repository.ts
    ├── api/
    │   ├── controllers/
    │   │   └── auth.controller.ts             # CommandBus/QueryBus dispatch
    │   └── presenters/
    │       ├── login.response.ts
    │       └── session-list.response.ts
    ├── event-listeners/
    │   └── user-logged-in.listener.ts         # @OnEvent('auth.login')
    └── acl/
        └── users-context.adapter.ts           # IUserLookupPort → calls users context ACL
```

---

## 🧩 Bounded Context: profile/

> Owns authenticated user's own data. Never owns auth logic.

```
modules/profile/
├── profile.module.ts                          # imports CqrsModule, registers handlers
├── __tests__/
│   └── application/
│       ├── commands/
│       │   ├── update-profile.handler.spec.ts
│       │   ├── change-password.handler.spec.ts
│       │   └── upload-avatar.handler.spec.ts
│       └── queries/
│           └── get-profile-by-user-id.handler.spec.ts
│
├── domain/
│   ├── entities/
│   │   └── profile.aggregate.ts
│   ├── value-objects/
│   │   ├── display-name.vo.ts
│   │   ├── bio.vo.ts
│   │   ├── avatar-url.vo.ts
│   │   ├── timezone.vo.ts
│   │   └── locale.vo.ts
│   ├── events/
│   │   ├── profile-updated.domain-event.ts
│   │   ├── password-changed.domain-event.ts
│   │   └── avatar-uploaded.domain-event.ts
│   └── ports/
│       ├── profile.repository.interface.ts
│       ├── audit.port.interface.ts
│       ├── avatar-storage.port.interface.ts
│       └── password-verifier.port.interface.ts    # ACL to users context
│
├── application/
│   ├── commands/
│   │   ├── update-profile.command.ts
│   │   ├── change-password.command.ts
│   │   ├── upload-avatar.command.ts
│   │   ├── delete-avatar.command.ts
│   │   └── handlers/
│   │       ├── update-profile.handler.ts          # logs 'profile.updated'
│   │       ├── change-password.handler.ts         # logs 'profile.password_changed'
│   │       ├── upload-avatar.handler.ts           # logs 'profile.avatar_uploaded'
│   │       └── delete-avatar.handler.ts           # logs 'profile.avatar_deleted'
│   │
│   ├── queries/
│   │   ├── get-profile-by-user-id.query.ts
│   │   └── handlers/
│   │       └── get-profile-by-user-id.handler.ts
│   │
│   ├── dtos/
│   │   ├── update-profile.dto.ts
│   │   ├── change-password.dto.ts
│   │   └── upload-avatar.dto.ts
│   └── read-models/
│       └── profile.read-model.ts
│
└── infrastructure/
    ├── persistence/
    │   ├── schemas/
    │   │   └── profile.prisma                 # Prisma model `Profile` — 1:1 with `User`
    │   ├── mappers/
    │   │   └── profile.mapper.ts
    │   └── repositories/
    │       └── prisma-profile.repository.ts
    ├── api/
    │   ├── controllers/
    │   │   └── profile.controller.ts          # CommandBus/QueryBus dispatch
    │   └── presenters/
    │       └── profile.response.ts
    ├── storage/
    │   └── s3-avatar-storage.adapter.ts       # IAvatarStoragePort → S3 avatars/ prefix
    └── acl/
        └── users-password-verifier.adapter.ts # IPasswordVerifierPort → users context ACL
```

---

## 🔄 Full Request Flow (CQRS)

```
HTTP / WebSocket Request
  └─► JWT Guard
  └─► Zod Validation Pipe
  └─► Audit Interceptor (POST/PATCH/PUT/DELETE — skipped with @SkipAudit)
  └─► Cache TTL Interceptor (GET only — skipped with @SkipCache)
        └─► Controller (injects CommandBus + QueryBus)
              │
              ├─► [READ] queryBus.execute(new GetXxxByIdQuery(id))
              │       └─► @QueryHandler(GetXxxByIdQuery) → GetXxxByIdHandler.execute()
              │             └─► Cache HIT  → returns cached response immediately
              │             └─► Cache MISS → Repository → ReadModel
              │                     └─► Stores result in Redis with TTL
              │
              └─► [WRITE] commandBus.execute(new CreateXxxCommand(dto))
                      └─► @CommandHandler(CreateXxxCommand) → CreateXxxHandler.execute()
                            ├─► Domain Aggregate — pure business logic
                            │     └─► aggregate.create() / .approve() / .complete() etc.
                            ├─► Repository.save(aggregate)              ← DB TX
                            ├─► IAuditPort.log(...)                     ← business audit
                            ├─► ICachePort.delByPattern(...) / .del(key) ← cache invalidation
                            └─► EventEmitter2.emit('xxx.created', new XxxCreatedEvent())
                                    └─► @OnEvent() listeners in infrastructure/event-listeners/
                                          └─► XxxGateway → WS emit to room
                                          └─► BullMQ processor (async side effects)
              │
              └─► [BULK]  commandBus.execute(new BulkDeleteXxxCommand(ids, actorId))
                      └─► @CommandHandler(BulkDeleteXxxCommand) → BulkDeleteXxxHandler.execute()
                            ├─► Repository.bulkDelete(ids) — ONE updateMany/deleteMany
                            ├─► ONE IAuditPort.log({ action: 'xxx.bulk_deleted', metadata: { ids, count }})
                            ├─► ONE delByPattern for list + pipelined del for item keys
                            └─► ONE EventEmitter2.emit('xxx.bulk_deleted', new XxxBulkDeletedEvent(ids))
```

---

## 🔁 Canonical Mutation Pattern — Transaction + Cache invalidation + Audit log (CommandHandler)

> This is the Hex/DDD counterpart of the same section in `.windsurf/skills/ARCHITECTURE-NEST-CRUD/SKILL.md`. CRUD wraps the body in an explicit `runInTx`; Hex/DDD uses the `@Transactional()` decorator from `@nestjs-cls/transactional` on the handler's `execute()` method, because each handler has a single entrypoint and the boundary is unambiguous.

**Opt-in, but all-or-nothing.** A bounded context MAY rely solely on the interceptors. The moment a CommandHandler does an explicit `IAuditPort.log()` **or** an explicit cache invalidation, **every** write handler in that context MUST do the full block — partial adoption is the exact drift this section prevents.

**Decorate the handler.** Every write CommandHandler / UseCase MUST have `@Transactional()` on `execute()`:

```typescript
import { Transactional } from '@nestjs-cls/transactional';

@CommandHandler(UpdateContactSupportCommand)
export class UpdateContactSupportHandler implements ICommandHandler<UpdateContactSupportCommand> {
  // ...constructor with USER_REPOSITORY, AUDIT_PORT, CACHE_PORT...

  @Transactional()
  async execute(command: UpdateContactSupportCommand): Promise<void> {
    // steps 1-3 below — DB writes auto-route to the active transaction
    // step 4: audit.log({...}, { strict: true })
    // tx commits when execute() resolves; step 5/6 run after commit
  }
}
```

**Fixed order inside every CommandHandler `execute()` (everything in steps 1–4 runs inside the tx; steps 5–6 run after commit):**

1. Load aggregate / existence check — throws **before** any side effect (no audit row, no tx open if invariant fails before any write).
2. `aggregate.<behavior>()` — pure domain mutation.
3. `await repository.save(aggregate)` — DB write inside the tx.
4. `await this.audit.log({ action, actorId?, resourceType, resourceId }, { strict: true })` — `strict: true` is required so a failed audit row aborts the surrounding tx. `action` = `{context}.{past_tense_verb}`; `resourceId` from the command payload / aggregate id, never raw request body. **Never** call `IAuditPort` from a QueryHandler (reads never audit — except export, which uses default `strict: false`).
5. `await this.cache.delByPattern(pattern)` and/or `await this.cache.del(key)` — targeted invalidation. Outside the tx by virtue of running after `execute()` returns.
6. `eventEmitter.emit(...)` — domain events, always **after** save + audit + invalidation. Listeners must never assume they run inside the original tx.

> Why the decorator and not `runInTx`? In Hex/DDD each handler has one `execute()` entrypoint and side-effects are already split into listeners. `@Transactional()` is the minimal change. In flat CRUD services there are many small methods and side-effects mix freely — see the CRUD skill's `runInTx` variant for the rationale.

**Ports, not infra (layering).** The application layer injects the cache through a port — never the concrete `CacheService`. The canonical CommandHandler code example (constructor + `execute()` body with all 6 steps annotated) lives in `.windsurf/skills/BACKEND-NEST/SKILL.md § §2 — CQRS Handler Rules → Command Handlers` (`ApproveProjectHandler`). The example below is intentionally **not** repeated here — both files must stay in sync, and the BACKEND-NEST one is the source of truth.

**Module binding (one-time wiring per bounded context):** Bind `{ provide: CACHE_PORT, useExisting: CacheService }` and `{ provide: AUDIT_PORT, useExisting: ActivityLogService }` in the feature module. Both `shared/cache` and `shared/activity-log` are `@Global()`, so no extra `imports:` entry is needed. Domain layer stays pure — `ICachePort` / `IAuditPort` are application-facing ports, never imported from `domain/`.

**Two cache-key conventions in this repo — pick by how the GET is cached:**

| GET cached via | Invalidation pattern | Used by |
|---|---|---|
| `CacheTtlInterceptor` (`@CacheTTL` on the controller) | `http:*:/{controller-route}*` (mirrors interceptor key `http:{userId}:{originalUrl}`) | flat CRUD (`companydata`, `blog-category`) |
| Handler/ReadModel sets its own keys | service-scoped `{context}-service:{entity}:{id}` + `{context}-service:{entity}:list:*` | Hex/DDD (`users`) |

> Never mix the two schemes in one context. `delByPattern` uses non-blocking `SCAN` and swallows Redis errors — cache is an optimization, never a hard dependency (OWASP #10 graceful degradation; the audit row in step 4 is the durable record — OWASP #9).

**Unit-test contract** (repository, `CACHE_PORT`, `AUDIT_PORT` all mocked — no real DB/Redis):

- Every spec for a `@Transactional()`-decorated handler MUST start with:
  ```typescript
  jest.mock('@nestjs-cls/transactional', () => ({
    Transactional:
      () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
        descriptor,
  }));
  ```
  This neutralizes the decorator so the unit test doesn't need a real `TransactionHost`. The decorator is verified by integration tests against a real Postgres.
- Each write handler asserts `audit.log` called with `(entry, { strict: true })` — Jest matches all positional arguments, so omitting the second object fails the assertion.
- `cache.del` / `cache.delByPattern` called with the exact key/pattern.
- One negative test per context: a write whose step-1 load fails ⇒ `audit.log` **not** called and no `cache.*` call.
- QueryHandler tests assert `audit.log` is **never** called (except the export handler, which uses default `strict: false`).

---

## 🗑️ Bulk Delete / Bulk Restore (Hex/DDD)

> **Scope.** Same trigger as flat CRUD: any module whose UI exposes multi-select actions on a list view. The Hex/DDD twist: bulk operations are **set-based commands** that bypass per-aggregate hydration. Loading N aggregates, calling N `.delete()` methods, and saving N times defeats the purpose of "bulk" and breaks the OWASP API #4 budget.
>
> **Soft vs hard delete.** Driven by the persistence model. If the Prisma row has `deletedAt: DateTime?`, the repository runs `updateMany`; otherwise `deleteMany`. Pick one strategy per bounded context and stick with it — mixing inside one context is forbidden.
>
> **Aggregate purity rule.** Domain invariants apply per-aggregate. A bulk operation that needs to enforce invariants on each row (e.g. "cannot delete an approved project") is **not** a bulk operation — it must fall back to the single-row command handler in a loop, OR the invariant must be lifted to a SQL `WHERE` clause inside `updateMany`. Bulk + per-aggregate invariants is an upgrade trigger toward a Saga, not a shortcut.

### Command payloads (plain TS — `application/commands/`)

```typescript
// bulk-delete-{module}.command.ts
export class BulkDelete{Module}Command {
  constructor(
    public readonly ids: string[],
    public readonly actorId: string,
  ) {}
}

// bulk-restore-{module}.command.ts (only if soft delete is enabled)
export class BulkRestore{Module}Command {
  constructor(
    public readonly ids: string[],
    public readonly actorId: string,
  ) {}
}
```

### Port — repository extension

```typescript
// domain/ports/{module}.repository.interface.ts
export interface I{Module}Repository {
  // ... single-row methods ...
  bulkDelete(ids: {Module}Id[]): Promise<{ count: number }>;
  bulkRestore(ids: {Module}Id[]): Promise<{ count: number }>; // soft delete only
}
```

> The port speaks **Value Objects** (`{Module}Id[]`), not raw strings. The mapper converts at the infrastructure boundary.

### Adapter — Prisma implementation

```typescript
// infrastructure/persistence/repositories/prisma-{module}.repository.ts
async bulkDelete(ids: {Module}Id[]): Promise<{ count: number }> {
  const idValues = ids.map(id => id.value);
  const result = await this.prisma.{module}.updateMany({
    where: { id: { in: idValues }, deletedAt: null },
    data:  { deletedAt: new Date() },
  });
  return { count: result.count };
}

async bulkRestore(ids: {Module}Id[]): Promise<{ count: number }> {
  const idValues = ids.map(id => id.value);
  const result = await this.prisma.{module}.updateMany({
    where: { id: { in: idValues }, deletedAt: { not: null } },
    data:  { deletedAt: null },
  });
  return { count: result.count };
}
```

### CommandHandler — canonical bulk variant

```typescript
// application/commands/handlers/bulk-delete-{module}.handler.ts
@CommandHandler(BulkDelete{Module}Command)
export class BulkDelete{Module}Handler implements ICommandHandler<BulkDelete{Module}Command> {
  constructor(
    @Inject({MODULE}_REPOSITORY) private readonly repo: I{Module}Repository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(CACHE_PORT) private readonly cache: ICachePort,
    private readonly events: EventEmitter2,
  ) {}

  async execute({ ids, actorId }: BulkDelete{Module}Command): Promise<{ count: number }> {
    // No per-id aggregate load. Set-based mutation only.
    const voIds = ids.map(id => {Module}Id.create(id));               // validates UUID per id
    const { count } = await this.repo.bulkDelete(voIds);              // step 1+2+3 fused

    await this.audit.log({                                            // step 4 — ONE row
      action: '{module}.bulk_deleted',
      actorId,
      resourceType: '{MODULE}',
      resourceId: ids.length === 1 ? ids[0] : null,
      metadata: { ids, count },
    });

    await this.cache.delByPattern('{module}-service:{module}:list:*'); // step 5 — list caches only
    for (const id of ids) {
      await this.cache.del(`{module}-service:{module}:${id}`);         // step 5 — invalidate item caches
    }

    this.events.emit('{module}.bulk_deleted',                          // step 6 — ONE event, ids[] payload
      new {Module}BulkDeletedEvent(ids, actorId));
    return { count };
  }
}
```

> ✅ One audit row (not N), one event (not N), one `delByPattern` for the list, then targeted item-key `del` for every id (cheap — single Redis pipeline). The for-loop on item keys is acceptable because Redis `DEL` is O(1) and we already paid the bound at the controller (`max(100)`).
>
> ❌ Looping `commandBus.execute(new Delete{Module}Command(id))` defeats the bulk purpose: N audit rows, N events, N TX boundaries.

### Domain event — one event for the whole batch

```typescript
// domain/events/{module}-bulk-deleted.domain-event.ts
export class {Module}BulkDeletedEvent {
  constructor(
    public readonly ids: readonly string[],
    public readonly actorId: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
```

> Listeners decide whether to fan out per-id work (e.g. ws broadcast per room) or batch. The domain emits **once**.

### Controller dispatch

```typescript
@Post('bulk-delete')
@HttpCode(200)
@CheckAbilities({ action: Action.Delete, subject: '{MODULE}' })
bulkDelete(
  @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
  @CurrentUser() user: UserJwtPayload,
): Promise<{ count: number }> {
  return this.commandBus.execute(new BulkDelete{Module}Command(dto.ids, user.id));
}

@Post('bulk-restore')
@HttpCode(200)
@CheckAbilities({ action: Action.Restore, subject: '{MODULE}' })
bulkRestore(
  @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
  @CurrentUser() user: UserJwtPayload,
): Promise<{ count: number }> {
  return this.commandBus.execute(new BulkRestore{Module}Command(dto.ids, user.id));
}
```

### Rules — bulk operations (Hex/DDD)

```
✅ Bulk commands carry ids[] + actorId only — never DTO fields per id
✅ Repository port returns { count: number } — frontend reconciles its grid by this number
✅ ONE updateMany / deleteMany per command — set-based, single TX
✅ ONE audit row per command — action ends in .bulk_deleted / .bulk_restored, ids[] in metadata
✅ ONE domain event per command — BulkDeletedEvent carries ids[], never one event per id
✅ Zod max(100) on ids[] in the DTO — DoS bound (OWASP API #4)
✅ Action.Restore (distinct from Action.Delete) for bulk-restore CASL check

❌ Bulk handler loading aggregates per id and calling .delete() on each — set-based only
❌ commandBus.execute() called inside a bulk handler — handlers do not orchestrate other handlers
❌ N audit rows / N domain events for a bulk — collapse into one of each
❌ Bulk + per-aggregate invariants in the same handler — that is a Saga, not a bulk
❌ Mixing soft and hard delete strategies inside one bounded context
❌ DELETE /{module} with body — always POST /bulk-delete + POST /bulk-restore
```

---

## 🗃️ Soft-delete visibility — `withTrashed` / `onlyTrashed` (Hex/DDD)

> **Authority.** Same contract as `ARCHITECTURE-NEST-CRUD/SKILL.md § Soft-delete visibility` — Laravel-style `withTrashed` / `onlyTrashed` query flags, backed by `src/shared/crud/trashed.util.ts`. The Hex/DDD twist: `TrashedMode` rides inside the `Query` payload (read side) and is honored by the QueryHandler + repository port. Commands (create/update/delete/restore/bulk*) are **unaffected** — they target identity, not visibility.
>
> **Scope.** Applies to any bounded context whose aggregate has a `deletedAt: DateTime?` column and exposes a list / single-get / export read route.

### DTO — Query (`application/dtos/`)

```typescript
// application/dtos/list-{module}.dto.ts
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  trashedFlagsShape,
  rejectBothTrashedFlags,
  BOTH_TRASHED_FLAGS_ERROR,
} from '../../../../shared/crud/trashed.util';

export const List{Module}QuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    // …context-specific filters
    ...trashedFlagsShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR);

export class List{Module}QueryDto extends createZodDto(List{Module}QuerySchema) {}
```

> Reuse this DTO for the matching `GET /{module}/export` endpoint. Single source of truth for soft-delete visibility on the read side.

### Query — payload carries `TrashedMode`

```typescript
// application/queries/get-{module}s-list.query.ts
import type { TrashedMode } from '../../../shared/crud/trashed.util';

export class Get{Module}sListQuery {
  constructor(
    public readonly dto: {
      // …filters
      trashed: TrashedMode;       // pre-resolved by the controller / handler
    },
  ) {}
}
```

### Repository port — set-based, mode-aware

```typescript
// domain/ports/{module}.repository.interface.ts
import type { TrashedMode } from '../../../../shared/crud/trashed.util';

export interface {Module}Filters {
  // …filters
  trashed: TrashedMode;
  page: number;
  limit: number;
}

export interface I{Module}Repository {
  findAll(filters: {Module}Filters): Promise<PaginatedResult<{Module}ReadModel>>;
  findById(id: {Module}Id, trashed: boolean): Promise<{Module}ReadModel | null>;
  // …command-side methods
}
```

> The port speaks `TrashedMode` (and a boolean for single-get). The adapter calls `buildTrashedWhere(mode)` once and spreads the fragment into its Prisma `where`. **No layer above infrastructure ever touches the `deletedAt` column directly.**

### Adapter — Prisma implementation

```typescript
// infrastructure/persistence/repositories/prisma-{module}.repository.ts
import { buildTrashedWhere } from '../../../../shared/crud/trashed.util';

async findAll(filters: {Module}Filters): Promise<PaginatedResult<{Module}ReadModel>> {
  const where: Prisma.{Module}WhereInput = {
    ...buildTrashedWhere(filters.trashed),
    // …other filters spread AFTER, never before
  };
  const [rows, total] = await this.prisma.$transaction([
    this.prisma.{module}.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters.limit, 100),
      skip: (filters.page - 1) * filters.limit,
    }),
    this.prisma.{module}.count({ where }),
  ]);
  return {
    data: rows.map((r) => this.mapper.toReadModel(r)),
    total,
    page: filters.page,
    limit: filters.limit,
  };
}

async findById(id: {Module}Id, trashed: boolean): Promise<{Module}ReadModel | null> {
  const where: Prisma.{Module}WhereInput = trashed
    ? { id: id.value }
    : { id: id.value, deletedAt: null };
  const row = await this.prisma.{module}.findFirst({ where });
  return row ? this.mapper.toReadModel(row) : null;
}
```

### QueryHandler — resolves the mode and forwards

```typescript
// application/queries/handlers/get-{module}s-list.handler.ts
import { resolveTrashedMode } from '../../../../shared/crud/trashed.util';

@Injectable()
@QueryHandler(Get{Module}sListQuery)
export class Get{Module}sListHandler implements IQueryHandler<Get{Module}sListQuery> {
  constructor(
    @Inject({MODULE}_REPOSITORY) private readonly repo: I{Module}Repository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(query: Get{Module}sListQuery): Promise<PaginatedResult<{Module}ReadModel>> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('Get{Module}sListHandler', { traceId, trashed: query.dto.trashed });

    return this.repo.findAll({
      // …filters
      page: query.dto.page,
      limit: query.dto.limit,
      trashed: query.dto.trashed,
    });
  }
}
```

> The controller MAY resolve `TrashedMode` from `withTrashed` / `onlyTrashed` and pass it in, OR build the Query with the raw booleans and let the handler call `resolveTrashedMode({...})` — pick **one** convention per bounded context. Reference: `src/modules/appointments` resolves inside the handler; `src/modules/users` resolves in the controller.

### Controller dispatch

```typescript
@Get()
@ApiQuery({ name: 'withTrashed', required: false, type: Boolean })
@ApiQuery({ name: 'onlyTrashed', required: false, type: Boolean })
@CacheTTL(TTL_SECONDS.MEDIUM)
@CheckAbilities({ action: Action.Read, subject: '{MODULE}' })
async list(
  @Query(new ZodValidationPipe(List{Module}QuerySchema)) dto: List{Module}QueryDto,
): Promise<PaginatedResponse<{Module}Response>> {
  return this.queryBus.execute(new Get{Module}sListQuery({
    ...dto,
    trashed: resolveTrashedMode({
      withTrashed: dto.withTrashed,
      onlyTrashed: dto.onlyTrashed,
    }),
  }));
}

@Get(':id')
@ApiQuery({ name: 'withTrashed', required: false, type: Boolean })
@CheckAbilities({ action: Action.Read, subject: '{MODULE}' })
async getById(
  @Param('id', ParseUUIDPipe) id: string,
  @Query('withTrashed') withTrashedRaw?: string,
): Promise<{Module}Response> {
  return this.queryBus.execute(
    new Get{Module}ByIdQuery(id, withTrashedRaw === 'true'),
  );
}
```

### Read-model contract

The `{Module}ReadModel` MUST expose `deletedAt: string | null` whenever the aggregate is soft-delete-aware. Without it, the `withTrashed` flag is useless on the client side.

### Authorization

| Endpoint | CASL | Why |
|---|---|---|
| `GET /{module}` (default) | `Action.Read` | Standard read |
| `GET /{module}?withTrashed=true` | `Action.Read` | Same surface, broader projection |
| `GET /{module}?onlyTrashed=true` (or `/{module}/trash`) | `Action.Restore` | Trash bin == prelude to restore. Prevents read-only users from enumerating tombstoned rows. |
| `GET /{module}/:id?withTrashed=true` | `Action.Read` | Restore screen needs the projection |
| `POST /{module}/:id/restore` | `Action.Restore` | Already gated |
| `POST /{module}/bulk-restore` | `Action.Restore` | Already gated |

> **Strong preference.** For `onlyTrashed`, expose a **dedicated route** (`GET /{module}/trash`) with its own `@CheckAbilities({ action: Action.Restore })` — clearer Swagger, clearer audit. Reserve the query-flag variant for `withTrashed=true` only.

### Cache

- The default `@CacheTTL(...)` keys by `originalUrl`, so `withTrashed` / `onlyTrashed` variants get their own entries.
- Hex/DDD modules use the `{context}-service:{aggregate}:*` key scheme (NOT the `http:*:/{route}*` scheme — see § Canonical Mutation Pattern). After every soft-delete / restore / bulk variant, the CommandHandler MUST `cache.delByPattern('{module}-service:{module}:list:*')` to drop every visibility variant in one pass.
- **Never** mix the two key schemes inside one bounded context.

### OWASP notes

- **API #1 BOLA / API #3 BOPLA:** `Action.Restore` gates the trash projection. A read-only user cannot enumerate recently deleted rows of resources they no longer have access to.
- **OWASP #3 Injection:** `buildTrashedWhere()` returns a closed-enum typed fragment — never accept arbitrary `where` from the client.
- **API #4 unrestricted resource consumption:** the standard `limit.max(100)` cap applies — soft-delete visibility does not unlock unbounded reads.

### Testing

```typescript
describe('Get{Module}sListHandler', () => {
  it.each(['exclude', 'include', 'only'] as const)(
    'forwards trashed mode %s into the repository filter',
    async (trashed) => {
      await handler.execute(new Get{Module}sListQuery({ page: 1, limit: 20, trashed }));
      expect(repo.findAll).toHaveBeenCalledWith(expect.objectContaining({ trashed }));
    },
  );
});
```

Reference implementations: `src/modules/appointments` (canonical Hex/DDD with trashed), `src/modules/users`, `src/modules/contact-support`.

### Rules — soft-delete visibility (Hex/DDD)

```
✅ Use trashedFlagsShape + rejectBothTrashedFlags in EVERY list/export DTO under application/dtos/
✅ Query payload carries TrashedMode (pre-resolved) — not raw booleans
✅ Repository port speaks TrashedMode (list) + boolean (single-get) — never expose `Prisma.WhereInput`
✅ Adapter calls buildTrashedWhere(mode) ONCE per query — no manual `deletedAt:` filtering above
✅ ReadModel exposes `deletedAt: string | null` whenever the aggregate is soft-delete-aware
✅ `onlyTrashed` (or `/{module}/trash` route) gated by Action.Restore, not Action.Read
✅ One `delByPattern('{module}-service:{module}:list:*')` after every soft-delete/restore/bulk

❌ Resolving TrashedMode in BOTH controller and handler — pick one site per bounded context
❌ z.coerce.boolean() on withTrashed/onlyTrashed — use the exported stringBoolean
❌ Filtering soft-deleted rows in JS — push `deletedAt` predicate into the Prisma `where`
❌ Per-aggregate hydration to filter `deletedAt` after the fact — set-based query only
❌ Bulk handler reading trashed flags — bulk targets ids, not visibility
❌ Reusing the http:*:/{route}* cache pattern inside a Hex/DDD context — stick to {context}-service:*
```

---

## 👤 Users & Auth response shape — roles + permissions (Hex/DDD)

> **Authority.** Same contract as `ARCHITECTURE-NEST-CRUD/SKILL.md § Users & Auth response shape`. This section restates the Hex/DDD-specific layering: `roles[]` + `permissions[]` are projected by **QueryHandlers** through a `UserReadModel`, never assembled in the presenter. Token-issuing commands (`/auth/login`, `/auth/refresh`) deliberately do NOT include these arrays.

### Canonical schemas (single source of truth)

```typescript
// modules/auth/infrastructure/api/presenters/auth.response.ts (already in repo)
export const MeRoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export const MePermissionSchema = z.object({
  action: z.string(),    // 'read' | 'create' | 'update' | 'delete' | 'restore' | 'export' | …
  subject: z.string(),   // 'WIDGET' | 'USER' | …
});

export const MeResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  // …profile fields
  roles: z.array(MeRoleSchema),
  permissions: z.array(MePermissionSchema),
  createdAt: z.string().datetime(),
});
```

> Import `MeRoleSchema` / `MePermissionSchema` from the auth presenter. Do NOT redefine them inside the users bounded context — that creates two schemas that drift independently.

### Endpoints — required projection

| Endpoint | Bounded context | `roles[]` | `permissions[]` | Notes |
|---|---|---|---|---|
| `GET /auth/me` | auth | ✅ effective | ✅ effective | Source of truth for the logged-in user. CASL `Ability` is built from this. |
| `GET /users` (list) | users | ✅ assigned | ✅ effective | Admin grid. Read-model collapses role-inherited + direct grants. |
| `GET /users/:id` | users | ✅ assigned | ✅ effective | Same as list, full detail. |
| `POST /users` (create) | users | ✅ | ✅ | Echo back so the UI doesn't refetch. Empty arrays allowed. |
| `PATCH /users/:id` | users | ✅ | ✅ | Same — echo after the write. |
| `POST /auth/login` | auth | ❌ | ❌ | Token only. UI calls `/auth/me` after login. |
| `POST /auth/refresh` | auth | ❌ | ❌ | Same. |

### Read-model + repository projection

```typescript
// modules/users/application/read-models/user.read-model.ts
import type { MePermission, MeRole } from '../../../auth/infrastructure/api/presenters/auth.response';

export interface UserReadModel {
  id: string;
  email: string;
  // …profile fields
  deletedAt: string | null;
  roles: MeRole[];
  permissions: MePermission[];  // effective, deduplicated
  createdAt: string;
  updatedAt: string;
}
```

```typescript
// modules/users/infrastructure/persistence/mappers/user.mapper.ts
toReadModel(row: UserWithJoins): UserReadModel {
  const roleRows = row.userRoles.map((ur) => ur.role);
  const fromRoles = roleRows.flatMap((r) =>
    r.rolePermissions.map((rp) => rp.permission),
  );
  const fromDirect = row.userPermissions.map((up) => up.permission);

  // Deduplicate on `${action}:${subject}` — a permission reachable through
  // two roles MUST appear once.
  const merged = new Map(
    [...fromRoles, ...fromDirect].map((p) => [`${p.action}:${p.subject}`, p]),
  );

  return {
    id: row.id,
    email: row.email,
    // …profile fields
    deletedAt: row.deletedAt?.toISOString() ?? null,
    roles: roleRows.map((r) => ({ id: r.id, name: r.name })),
    permissions: [...merged.values()].map((p) => ({ action: p.action, subject: p.subject })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
```

> **Mapper, not handler.** The flatten/dedupe lives in the infrastructure mapper alongside the Prisma `include`. The QueryHandler only forwards the read model. Presenters do zero data work — they re-shape ISO strings, not domain joins.

### Auth `MeReadModel` — cross-context read

`/auth/me` does NOT load a `UserAggregate` — it reads through `IUserReadProjection.findMeById(userId)` exposed by the users bounded context. The auth context is **read-only** against users: the projection returns the same `roles[]` + `permissions[]` shape, plus auth-specific flags (`totpEnabled`, `passwordConfirmed`, `hasGoogleAuth`, `emailVerified`).

```typescript
// modules/auth/domain/ports/user-read.port.ts
export interface IUserReadProjection {
  findMeById(userId: string): Promise<MeReadModel | null>;
}
```

> Cross-context reads MUST go through a port owned by the consumer (auth), implemented by an adapter that calls the users read model. Never inject `IUserRepository` (users domain) into an auth handler — that breaks the bounded-context boundary.

### Security & privacy

- **`UserResponseSchema` is a strict allowlist.** Never echo `passwordHash`, `totpSecret`, `backupCodes`, `mfaSecret`, `refreshToken`, or any session/recovery field. The mapper does NOT select these columns from Prisma.
- **Permission rows expose `{ action, subject }` only** — never internal `permission.id` / `createdAt`. Internal IDs leak the permission catalog structure (OWASP API #3 BOPLA).
- **`GET /users` is admin-only.** Gate with `@CheckAbilities({ action: Action.Read, subject: 'USER' })` AND a CASL rule that scopes the read-model by tenant / company inside `CaslAbilityFactory`. Otherwise a single compromised admin token enumerates every tenant's ACL surface.
- **Never log the full `permissions` array.** `logger.info({ permissionsCount: perms.length })` — count, not contents.

### Cache

- `GET /auth/me` MUST use `@SkipCache()` OR a per-user TTL ≤ 60s. Permissions change mid-session — a stale cache hands an attacker a deleted role.
- `GET /users` MAY use `@CacheTTL(TTL_SECONDS.SHORT)`, but every CommandHandler that touches `user_roles` / `role_permissions` / `user_permissions` MUST `cache.delByPattern('users-service:user:list:*')` AND `cache.delByPattern('auth-service:me:*')`. Otherwise revoked permissions linger until TTL.
- Domain events: emit `user.roles_changed` / `role.permissions_changed` so the auth bounded context can invalidate its own `me:*` projection cache via an `@OnEvent` listener.

### OWASP notes

- **API #1 BOLA / #3 BOPLA:** `permissions[]` tells an attacker exactly what to probe — pair every user-listing route with tenant-scoped CASL rules.
- **OWASP #5 Security Misconfiguration:** `roles[]` / `permissions[]` MUST be empty arrays — never `null`, never absent. Clients must not branch on "field missing vs empty".
- **API #9 Improper inventory management:** `MePermissionSchema` is consumed by the frontend's CASL `Ability`. Silently adding a field can break route guards — bump the version explicitly.

### Rules — roles & permissions in response (Hex/DDD)

```
✅ MeRoleSchema / MePermissionSchema live in modules/auth/.../presenters and are imported elsewhere
✅ Read-model (UserReadModel / MeReadModel) carries `roles[]` + flat `permissions[]` — handlers forward, never assemble
✅ Mapper deduplicates effective permissions on `${action}:${subject}`
✅ Cross-context read (auth → users) goes through an auth-owned port, NOT IUserRepository
✅ GET /auth/me, GET /users, GET /users/:id all emit roles[] + permissions[] (effective, deduped)
✅ Empty assignments → empty arrays — never null, never absent
✅ Every command touching ACL emits a domain event so auth invalidates its own me:* cache

❌ /auth/login or /auth/refresh returning roles[] / permissions[] — token endpoints stay lean
❌ Returning passwordHash, totpSecret, backupCodes, mfaSecret, refreshToken in a user projection
❌ Returning nested role.permissions[] in the response — flatten in the mapper
❌ Importing IUserRepository (users domain) from inside auth handlers — cross-context = port + adapter
❌ Caching /auth/me with the default TTL — permissions are live, cache is stale
❌ Logging the full permissions array — log count only
❌ Presenter re-deriving role/permission shape — single source of truth lives in auth presenters
```

---

## 📐 Architecture Rules (NEVER break)

```
domain/         ← ZERO imports from NestJS, Prisma, HTTP, Redis, ExcelJS, PDFKit
                ← Pure TypeScript only
                ← Domain events are plain TS classes — no @nestjs/cqrs IEvent or EventEmitter2

application/    ← Only imports from domain/
                ← NEVER imports infrastructure/ directly
                ← Injects ports via Symbol tokens only
                ← Command Handlers: @CommandHandler decorator + ICommandHandler<T> interface
                ← Query Handlers:   @QueryHandler decorator + IQueryHandler<T> interface
                ← Commands live in application/commands/*.command.ts (plain TS, no NestJS deps)
                ← Queries live in application/queries/*.query.ts (plain TS, no NestJS deps)
                ← Uses EventEmitter2 (injected) to publish domain events AFTER repo.save()
                ← Allowed imports from @nestjs/cqrs: CommandHandler, ICommandHandler,
                    QueryHandler, IQueryHandler — NOTHING else (no EventBus, no AggregateRoot)

infrastructure/ ← Implements all interfaces defined in domain/
                ← Only layer allowed to import Prisma (PrismaService / generated client),
                ←   Redis, HTTP, S3, ExcelJS, PDFKit
                ← Registers all @Inject(SYMBOL) → ConcreteClass bindings in the module
                ← Controller dispatches via CommandBus / QueryBus — never injects handlers directly
                ← @OnEvent() listeners live here

core/           ← Imported by AppModule — applies globally
                ← NEVER imports from modules/

shared/         ← Importable by any module
                ← NEVER imports from modules/ (prevents circular dependencies)

CQRS Rules:
  ✅ Every Hex/DDD module imports CqrsModule and registers handlers as providers
  ✅ Commands are classes in application/commands/*.command.ts — carry only the data needed
  ✅ Queries are classes in application/queries/*.query.ts — carry filters/IDs
  ✅ Handlers live in application/{commands|queries}/handlers/*.handler.ts
  ✅ CommandHandlers live in application/commands/handlers/ — decorated @CommandHandler(XxxCommand)
  ✅ QueryHandlers live in application/queries/handlers/ — decorated @QueryHandler(XxxQuery)
  ✅ Controller injects CommandBus + QueryBus (from @nestjs/cqrs) — dispatches, never calls handlers
  ✅ Domain events still use EventEmitter2 (@nestjs/event-emitter) — NOT @nestjs/cqrs EventBus
  ✅ CqrsModule.forRoot() registered ONCE in AppModule (or root-level import)

Anti-patterns:
  ❌ Controller injecting handlers directly — ALWAYS use CommandBus/QueryBus
  ❌ Using @nestjs/cqrs EventBus for domain events — use EventEmitter2 + @OnEvent()
  ❌ Using @nestjs/cqrs AggregateRoot base class — domain stays pure TS
  ❌ Command/Query classes importing NestJS or infra — they are plain TS payloads
  ❌ IAuditPort called inside QueryHandlers (reads never audit — except export)
  ❌ CRUD list endpoint without matching /export?format=xlsx|pdf
  ❌ Export implemented for xlsx but not pdf (or vice versa)
  ❌ @ExportColumn on password, token, secret, or any sensitive field
  ❌ GET controller method without @CacheTTL() — always declare a tier
  ❌ Magic number TTL values — always use TTL_SECONDS constants
  ❌ Whole-DB cache flush (Redis FLUSHALL) — invalidate by key / delByPattern only
  ❌ Export endpoint serving cached data — @SkipCache() is mandatory
  ❌ Opting into explicit IAuditPort.log() or cache invalidation in only SOME write
     handlers of a context — all-or-nothing (Canonical Mutation Pattern)
  ❌ audit.log() or cache invalidation running before Repository.save(), or before
     the step-1 existence check passes
  ❌ Domain events emitted before audit + cache invalidation — order is save → audit → cache → emit
  ❌ Application layer injecting concrete CacheService — inject CACHE_PORT (ICachePort) only
  ❌ Mixing the http:*:/{route}* and {context}-service:* cache-key schemes in one context
  ❌ Business logic in Controller — belongs in Aggregate or CommandHandler
  ❌ Domain Events emitted before Repository.save() — always after
  ❌ Domain Events emitted from Aggregate — CommandHandler owns the publish step
  ❌ Circuit Breaker wrapping domain or DB calls — external infra only
  ❌ WebSocket Gateway importing from another bounded context directly
  ❌ Backup service calling Prisma repositories — use pg_dump directly
  ❌ Hardcoded secrets — env vars only, validated with Zod at bootstrap
  ❌ console.log / console.warn / console.error — always use LoggerService
  ❌ Log entry missing traceId or correlationId
  ❌ Logging request body, response body, or full SQL queries in production
  ❌ Logging password, token, secret, or authorization header values
  ❌ Pino instantiated directly — always inject `Logger` from `nestjs-pino` (configured once in AppModule via `LoggerModule.forRoot`)
  ❌ BullMQ processor outside infrastructure/jobs/ — never in application/ or domain/
  ❌ BullMQ job exhausting retries without an ERROR log
  ❌ Circuit breaker opening without a WARN log
  ❌ Mutation route without @UseGuards(JwtAuthGuard, CaslGuard)
  ❌ resourceId read from request body — always from route params for ownership checks
  ❌ Ownership check inside UseCase or domain — belongs in CaslGuard only
  ❌ SUPER_ADMIN role checked anywhere except CaslAbilityFactory
  ❌ Bulk delete/restore implemented as N single-id commands — set-based updateMany/deleteMany only
  ❌ Bulk handler emitting one domain event per id — emit ONE BulkXxxEvent with ids[] payload
  ❌ Bulk endpoint without Zod max(100) cap on ids[] — unbounded DoS surface (OWASP API #4)
```
