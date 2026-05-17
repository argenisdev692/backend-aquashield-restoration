---
description: Directory structure of each NestJS service — Hexagonal / DDD (UseCase pattern). Use for complex bounded contexts with real business rules, events, workflows, or cross-context coordination. For simple CRUD modules, start with `.claude/skills/ARQUITECTURE-NEST-CRUD/SKILL.md`. For coding rules, naming, testing, logging, cache, and exports → see `.claude/skills/BACKEND-NEST/SKILL.md`.
globs: src/**
---

# ARQUITECTURE-NEST — Directory Structure (2026)

> **Authority**: SINGLE SOURCE OF TRUTH for all file placement and module structure.
> **Pattern**: Hexagonal Architecture + DDD — Use Case services, Port/Adapter, Domain Events via EventEmitter2.
> **When to use this**: only when the module has complex business rules, domain events, ACL, or cross-context coordination.
> **Default for small features**: use `.claude/skills/ARQUITECTURE-NEST-CRUD/SKILL.md` first; escalate here only when the simpler structure is no longer enough.
> **For coding rules, naming conventions, testing strategy, logging, cache, exports → see `.claude/skills/BACKEND-NEST/SKILL.md`.**

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
│   │   ├── cache.module.ts               # ioredis-backed @nestjs/cache-manager 3.x
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

```
modules/{module}/
├── {module}.module.ts              # Providers + port Symbol bindings
│
├── __tests__/
│   ├── domain/
│   │   └── {module}.aggregate.spec.ts    # Pure unit — zero NestJS/Prisma
│   └── application/
│       ├── create-{module}.use-case.spec.ts
│       ├── update-{module}.use-case.spec.ts
│       └── export-{module}.use-case.spec.ts
│
├── domain/                         # 🔵 ZERO NestJS / infra dependencies
│   ├── entities/
│   │   └── {module}.aggregate.ts
│   ├── value-objects/
│   │   └── *.vo.ts
│   ├── exceptions/
│   │   └── {module}-domain.exception.ts
│   ├── events/
│   │   └── {module}-created.domain-event.ts  # Plain TS class — no @nestjs/cqrs
│   ├── repositories/
│   │   └── {module}.repository.interface.ts  # I{Module}Repository (outbound port)
│   └── ports/
│       └── outbound/
│           ├── audit.port.interface.ts        # IAuditPort (re-used from shared)
│           └── notification.port.interface.ts # INotificationPort (if needed)
│
├── application/                    # 🟡 Orchestration only — no infra imports
│   ├── use-cases/
│   │   ├── create-{module}.use-case.ts
│   │   ├── update-{module}.use-case.ts
│   │   ├── delete-{module}.use-case.ts
│   │   ├── get-{module}-by-id.use-case.ts
│   │   ├── get-{module}-list.use-case.ts
│   │   └── export-{module}.use-case.ts       # @SkipCache() on controller + IAuditPort.log()
│   ├── read-models/
│   │   └── {module}.read-model.ts            # Fields with @ExportColumn where applicable
│   └── dtos/
│       ├── create-{module}.dto.ts            # Zod schema + z.infer<>
│       └── update-{module}.dto.ts
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
    │   │   └── {module}.controller.ts        # REST: injects UseCases directly, no bus
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

## 🧩 Bounded Context: users/

> CRUD for user entities. Does NOT own login, OTP, reset password, or profile update.

```
modules/users/
├── users.module.ts
├── __tests__/
│   ├── domain/
│   │   ├── user.aggregate.spec.ts
│   │   └── email.value-object.spec.ts
│   └── application/
│       ├── create-user.use-case.spec.ts
│       ├── suspend-user.use-case.spec.ts
│       └── export-users.use-case.spec.ts
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
│   ├── repositories/
│   │   └── user.repository.interface.ts       # IUserRepository
│   ├── services/
│   │   └── password-hasher.service.ts
│   └── ports/
│       └── outbound/
│           ├── email.service.interface.ts      # IEmailService
│           └── audit.port.interface.ts         # IAuditPort
│
├── application/
│   ├── use-cases/
│   │   ├── create-user.use-case.ts            # logs 'users.created'
│   │   ├── update-user.use-case.ts            # logs 'users.updated'
│   │   ├── delete-user.use-case.ts            # soft delete, logs 'users.deleted'
│   │   ├── suspend-user.use-case.ts           # logs 'users.suspended'
│   │   ├── change-password.use-case.ts        # logs 'users.password_changed'
│   │   ├── get-user-by-id.use-case.ts
│   │   ├── get-users-list.use-case.ts
│   │   └── export-users.use-case.ts           # logs 'users.export'
│   ├── read-models/
│   │   └── user.read-model.ts
│   └── dtos/
│       ├── create-user.dto.ts
│       └── update-user.dto.ts
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
    │   │   └── users.controller.ts            # CRUD + GET /users/export?format=xlsx|pdf
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
├── auth.module.ts
├── __tests__/
│   ├── domain/
│   │   ├── otp.aggregate.spec.ts
│   │   └── auth-session.aggregate.spec.ts
│   └── application/
│       ├── login.use-case.spec.ts
│       ├── verify-otp.use-case.spec.ts
│       └── refresh-token.use-case.spec.ts
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
│   ├── repositories/
│   │   ├── auth-session.repository.interface.ts
│   │   └── otp.repository.interface.ts
│   ├── services/
│   │   ├── token-generator.service.ts
│   │   ├── otp-generator.service.ts
│   │   └── password-reset-token.service.ts
│   └── ports/
│       └── outbound/
│           ├── audit.port.interface.ts
│           ├── notification.port.interface.ts
│           └── user-lookup.port.interface.ts  # ACL to users context
│
├── application/
│   ├── use-cases/
│   │   ├── login.use-case.ts                  # logs 'auth.login'
│   │   ├── logout.use-case.ts                 # logs 'auth.logout'
│   │   ├── logout-all-sessions.use-case.ts    # logs 'auth.logout_all'
│   │   ├── refresh-token.use-case.ts          # logs 'auth.token_refreshed'
│   │   ├── request-otp.use-case.ts            # logs 'auth.otp_requested'
│   │   ├── verify-otp.use-case.ts             # logs 'auth.otp_verified' or 'auth.otp_failed'
│   │   ├── request-password-reset.use-case.ts # always HTTP 200 — no email enumeration
│   │   ├── reset-password.use-case.ts         # logs 'auth.password_reset'
│   │   ├── enable-2fa.use-case.ts             # logs 'auth.2fa_initiated'
│   │   ├── confirm-2fa.use-case.ts            # logs 'auth.2fa_enabled'
│   │   ├── disable-2fa.use-case.ts            # logs 'auth.2fa_disabled'
│   │   └── get-active-sessions.use-case.ts
│   ├── read-models/
│   │   └── auth-session.read-model.ts
│   └── dtos/
│       ├── login.dto.ts
│       ├── request-otp.dto.ts
│       ├── verify-otp.dto.ts
│       ├── request-password-reset.dto.ts
│       ├── reset-password.dto.ts
│       └── verify-reset-token.dto.ts
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
    │   │   └── auth.controller.ts
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
├── profile.module.ts
├── __tests__/
│   └── application/
│       ├── get-profile.use-case.spec.ts
│       ├── update-profile.use-case.spec.ts
│       ├── change-password.use-case.spec.ts
│       └── upload-avatar.use-case.spec.ts
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
│   ├── repositories/
│   │   └── profile.repository.interface.ts
│   └── ports/
│       └── outbound/
│           ├── audit.port.interface.ts
│           ├── avatar-storage.port.interface.ts
│           └── password-verifier.port.interface.ts  # ACL to users context
│
├── application/
│   ├── use-cases/
│   │   ├── get-profile-by-user-id.use-case.ts
│   │   ├── update-profile.use-case.ts             # logs 'profile.updated'
│   │   ├── change-password.use-case.ts            # logs 'profile.password_changed'
│   │   ├── upload-avatar.use-case.ts              # logs 'profile.avatar_uploaded'
│   │   └── delete-avatar.use-case.ts              # logs 'profile.avatar_deleted'
│   ├── read-models/
│   │   └── profile.read-model.ts
│   └── dtos/
│       ├── update-profile.dto.ts
│       ├── change-password.dto.ts
│       └── upload-avatar.dto.ts
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
    │   │   └── profile.controller.ts          # GET /profile/me, PATCH, POST avatar, DELETE avatar
    │   └── presenters/
    │       └── profile.response.ts
    ├── storage/
    │   └── s3-avatar-storage.adapter.ts       # IAvatarStoragePort → S3 avatars/ prefix
    └── acl/
        └── users-password-verifier.adapter.ts # IPasswordVerifierPort → users context ACL
```

---

## 🔄 Full Request Flow

```
HTTP / WebSocket Request
  └─► JWT Guard
  └─► Zod Validation Pipe
  └─► Audit Interceptor (POST/PATCH/PUT/DELETE — skipped with @SkipAudit)
  └─► Cache TTL Interceptor (GET only — skipped with @SkipCache)
        └─► Controller
              │
              ├─► [READ] GetXxxByIdUseCase.execute(id)
              │       └─► Cache HIT  → returns cached response immediately
              │       └─► Cache MISS → Prisma query → ReadModel
              │               └─► Stores result in Redis with TTL
              │
              └─► [WRITE] CreateXxxUseCase.execute(dto)
                      ├─► Domain Aggregate — pure business logic
                      │     └─► aggregate.create() / .approve() / .complete() etc.
                      ├─► Repository.save(aggregate)              ← DB TX
                      ├─► IAuditPort.log(...)                     ← business audit
                      ├─► CacheManager.del(affected keys)         ← cache invalidation
                      └─► EventEmitter2.emit('xxx.created', new XxxCreatedEvent())
                              └─► @OnEvent() listeners in infrastructure/event-listeners/
                                    └─► XxxGateway → WS emit to room
                                    └─► BullMQ processor (async side effects)
```

---

## 📐 Architecture Rules (NEVER break)

```
domain/         ← ZERO imports from NestJS, Prisma, HTTP, Redis, ExcelJS, PDFKit
                ← Pure TypeScript only
                ← Domain events are plain TS classes — no @nestjs/cqrs or EventEmitter2

application/    ← Only imports from domain/
                ← NEVER imports infrastructure/ directly
                ← Injects ports via Symbol tokens only
                ← NEVER imports @nestjs/common (except @Injectable)
                ← Uses EventEmitter2 injected from NestJS to publish domain events

infrastructure/ ← Implements all interfaces defined in domain/
                ← Only layer allowed to import Prisma (PrismaService / generated client),
                ←   Redis, HTTP, S3, ExcelJS, PDFKit
                ← Registers all @Inject(SYMBOL) → ConcreteClass bindings in the module
                ← @OnEvent() listeners live here

core/           ← Imported by AppModule — applies globally
                ← NEVER imports from modules/

shared/         ← Importable by any module
                ← NEVER imports from modules/ (prevents circular dependencies)

Anti-patterns:
  ⚠️ @nestjs/cqrs as the default pattern — prefer application/use-cases/. The package is installed for future opt-in only;
     introducing CommandBus / QueryBus / EventBus requires an explicit, documented decision per bounded context.
  ❌ IAuditPort called inside read UseCases (get-*/export-* excluded from audit)
  ❌ CRUD list endpoint without matching /export?format=xlsx|pdf
  ❌ Export implemented for xlsx but not pdf (or vice versa)
  ❌ @ExportColumn on password, token, secret, or any sensitive field
  ❌ GET controller method without @CacheTTL() — always declare a tier
  ❌ Magic number TTL values — always use TTL_SECONDS constants
  ❌ CacheManager.reset() in production
  ❌ Export endpoint serving cached data — @SkipCache() is mandatory
  ❌ Business logic in Controller — belongs in Aggregate or UseCase
  ❌ Domain Events emitted before Repository.save() — always after
  ❌ Domain Events emitted from Aggregate — UseCases own the publish step
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
```
