---
description: Directory structure of each NestJS service — Simple CRUD (Service/Repository pattern). Recommended default for solo developers and small features. Use for modules with ≤8 fields and no complex business rules. For complex bounded contexts with domain logic, events, or workflows → see `.claude/skills/ARQUITECTURE-NEST/SKILL.md`.
globs: src/modules/**
---

# ARQUITECTURE-NEST-CRUD — Simple CRUD Structure (2026)

> **Authority**: SINGLE SOURCE OF TRUTH for simple CRUD module file placement.
> **When to use this**: modules with ≤8 fields, no domain events, no sagas, no cross-context orchestration.
> **Default for this repo**: start here unless the module has real business rules, workflows, or cross-context coordination.
> **When to upgrade to `.claude/skills/ARQUITECTURE-NEST/SKILL.md`**: module grows business rules, needs events, or coordinates with other contexts.

---

## 🧭 Quick Decision Guide

| Signal | Use this file | Use `ARQUITECTURE-NEST/SKILL.md` |
|---|---|---|
| Fields | ≤8 | Any |
| Business rules | None / trivial | Validations, state machines |
| Events | No | Yes |
| Cross-context | No | Yes (ACL adapters) |
| Export (xlsx/pdf) | No | Yes |
| Example | `categories`, `tags`, `reasons`, `statuses` | `projects`, `estimates`, `contractors` |

---

## 📁 Simple CRUD Module Structure

```
modules/{module}/
├── {module}.module.ts              # Providers + repository binding. Export Service only if another module needs it.
│
├── __tests__/
│   └── {module}.service.spec.ts   # Unit tests — mock repository only, zero NestJS bootstrap
│
├── dto/
│   ├── create-{module}.dto.ts     # Zod schema + inferred type. No class-validator, no class-transformer.
│   └── update-{module}.dto.ts     # CreateSchema.partial() — never duplicate field definitions
│
├── {module}.prisma                # Prisma model (mirror under `prisma/schema/{module}.prisma`). Move to a shared schema file if used by multiple modules.
├── {module}.entity.ts             # Plain TypeScript interface — shape of the domain object. No NestJS, no Prisma, no decorators.
├── {module}.repository.ts         # ALL Prisma queries live here. Returns entity types, never raw rows. Returns null (not undefined) when not found.
├── {module}.service.ts            # Orchestration only: calls repository, throws NotFoundException. No DB imports.
├── {module}.controller.ts         # HTTP layer only: routes, guards, Zod pipe, status codes. Never calls repository directly.
└── {module}.gateway.ts            # 🟡 OPTIONAL — only if this module emits real-time events. Imports WsRoomsService from `shared/websockets/`. Registered in {module}.module.ts as a provider.
```

> **That's it. No domain/, no application/, no infrastructure/ folders.**
> `{module}.gateway.ts` is the ONLY optional file — add it the day a service method needs to broadcast a mutation; remove it if not used.

---

## 📄 File Responsibilities

### `{module}.entity.ts`
Plain TypeScript interface — shape of the domain object. No NestJS, no Prisma, no decorators. Always includes `id`, `createdAt`, `updatedAt`. Nullable fields typed as `T | null`, never `T | undefined`.

---

### `dto/create-{module}.dto.ts`
Zod v4 schema exported as `Create{Module}Schema` + inferred type `Create{Module}Dto`. Import from `zod` (the main entry of `zod@^4` already exports v4 — the legacy `zod/v4` subpath is unnecessary). Always export both the schema and the type — the schema goes to the pipe, the type goes to the service signature.

### `dto/update-{module}.dto.ts`
Always derived from `Create{Module}Schema.partial()`. Never redefine fields. Export `Update{Module}Schema` + `Update{Module}Dto`.

---

### `{module}.prisma`
Prisma model definition — copy/move it under `prisma/schema/{module}.prisma` so the Prisma CLI's multi-file schema discovers it. Primary key is `String @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid` (UUID v7 from the DB function in `prisma/bootstrap.sql`). Always include `createdAt` and `updatedAt` mapped to `created_at` / `updated_at` with `@default(now())`. For tables whose `updated_at` is managed by the DB trigger, DO NOT use `@updatedAt`.

---

### `{module}.repository.ts`
The only file in the module that imports `PrismaService` (which extends `PrismaClient` from `src/generated/prisma/client`). All methods return entity types — never raw Prisma row types. `findById` and `update` return `Entity | null` (not `undefined`); convert Prisma's `null` from `findUnique` directly. `delete` returns `boolean`. UUID v7 generation is handled by the DB default (`uuid_generate_v7()`) — the repository does NOT pre-generate ids. Never throws `HttpException` — return `null` and let the service decide.

---

### `{module}.service.ts`
Orchestration only. Injects repository. Maps `null` returns to `NotFoundException`. No `DatabaseService` import. No business logic beyond "call repo → check result → throw if missing". If a service method exceeds ~20 lines, it's a signal to upgrade to `ARQUITECTURE-NEST/SKILL.md`.

---

### `{module}.controller.ts`
HTTP layer only. Applies `@UseGuards(JwtAuthGuard, CaslGuard)` at class level. Applies `ZodValidationPipe` per mutation route (`POST`, `PATCH`) using the schema from `dto/`. Read routes (`GET`) need no pipe. `DELETE` always returns `204 No Content`. Never imports repository — always through service. Never contains `if/else` business logic.

Every controller MUST carry full Swagger decorators:

```typescript
import { createZodDto } from 'nestjs-zod'; // ← from 'nestjs-zod', never '/dto'
import {
  ApiTags, ApiBearerAuth,
  ApiCreatedResponse, ApiOkResponse, ApiNoContentResponse,
  ApiNotFoundResponse, ApiBadRequestResponse,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('{module}s')
@ApiBearerAuth()
@Controller('{module}s')
@UseGuards(JwtAuthGuard, CaslGuard)
export class {Module}Controller {

  @Post()
  @ApiCreatedResponse({ type: {Module}Response })   // POST → 201
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async create(
    @Body(new ZodValidationPipe(Create{Module}Schema)) dto: Create{Module}Dto,
  ): Promise<{Module}Response> { ... }

  @Get()
  @ApiOkResponse({ type: [{Module}Response] })
  findAll(): Promise<{Module}Response[]> { ... }

  @Get(':id')
  @ApiOkResponse({ type: {Module}Response })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<{Module}Response> { ... }

  @Patch(':id')
  @ApiOkResponse({ type: {Module}Response })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(Update{Module}Schema)) dto: Update{Module}Dto,
  ): Promise<{Module}Response> { ... }

  @Delete(':id')
  @ApiNoContentResponse()                           // DELETE → 204
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> { ... }
}
```

Response type must also use `createZodDto` so Swagger renders the output schema:

```typescript
// {module}.entity.ts  ← or a separate {module}.response.ts
export const {Module}ResponseSchema = z.object({
  id:        z.string().uuid(),
  name:      z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export class {Module}Response extends createZodDto({Module}ResponseSchema) {}
```

---

### `{module}.module.ts`
Declares `controllers`, `providers` (Service + Repository), and `exports` (Service only, and only if another module needs it). No `CqrsModule`. No port/symbol bindings needed at this scale.

---

## 🔄 Request Flow (Simple CRUD)

```
HTTP Request
  └─► JwtAuthGuard              (core/guards)
  └─► RolesGuard                (core/guards)
  └─► ZodValidationPipe         (core/pipes) — POST/PATCH only
  └─► Controller
        └─► Service
              └─► Repository
                    └─► Prisma → PostgreSQL (via @prisma/adapter-pg)
              └─► null → NotFoundException
        └─► returns entity (serialize.interceptor strips private fields)
        └─► global-exception.filter maps exceptions → RFC 7807
```

---

## 📐 Rules (NEVER break)

```
✅ Repository     ← ONLY file that imports PrismaService / generated Prisma types
✅ Service        ← calls repository, throws NotFoundException, nothing else
✅ Controller     ← HTTP concerns only: routes, guards, pipes, status codes
✅ DTO            ← Zod schema + inferred type. No class-validator.
✅ Entity         ← plain TypeScript interface. No ORM decorators.
✅ Null returns   ← repository returns null (not undefined) when row not found

❌ Controller calling Repository directly — always go through Service
❌ Service importing DatabaseService — Repository owns all DB access
❌ Business logic in Controller or Repository — belongs in Service
   (if it grows complex: upgrade to Aggregate in `ARQUITECTURE-NEST/SKILL.md`)
❌ Zod schema defined inline in Controller — always in dto/ file
❌ any / unknown return types — always return typed entity
❌ console.log / console.warn — always use LoggerService from @/logger
❌ Hardcoded role strings — use a Roles enum or constants file
❌ Repository throwing HttpException — return null, let Service throw
❌ Repository returning undefined — always null (explicit type + JSON-safe)
❌ uuid CommonJS require() — uuid v12+ is ESM only: import { v7 as uuidv7 } from 'uuid'
❌ @UsePipes per route if APP_PIPE global is already registered
   → with nestjs-zod + createZodDto + APP_PIPE you don't need per-route @UsePipes
```

---

## 📦 Shared Infrastructure (consumed by CRUD modules)

> Cross-cutting concerns live in `src/shared/` and are injected into any service — **regardless of whether the module is simple CRUD or Hex/DDD**. You do NOT need to upgrade architecture to use them. See `.claude/skills/ARQUITECTURE-NEST/SKILL.md` for the full `shared/` tree.

| Concern | Folder | Inject in service as | Use case |
|---|---|---|---|
| Logger | `shared/logger` (or `nestjs-pino`) | `LoggerService` | Always — never `console.log` |
| Request context | `shared/cls` (`nestjs-cls`) | `ClsService` | traceId / correlationId propagation |
| Activity log | `shared/activity-log` | `IAuditPort` | Manual call in any write method (`create`, `update`, `delete`) |
| Backup DB | `shared/backup` | (scheduler runs autonomously) | Cron-driven — no module integration needed |
| Excel export | `shared/export` | `IExcelExporter` via `ExportService` | Inject in service, call from a `GET /{module}/export?format=xlsx` route |
| PDF export | `shared/export` | `IPdfExporter` (PDFKit adapter) | Same as Excel. PDFKit is the only PDF engine — lightweight, streaming, no Chromium dependency. |
| Circuit breaker | `shared/external` (cockatiel) | via `@CircuitBreaker('name')` decorator | Wraps ANY outbound HTTP call |
| AI clients | `shared/external/ai` | `IAiClient` | OpenAI / Anthropic — already CB-wrapped |
| FastAPI client | `shared/external/fastapi` | `IFastapiClient` | Internal Python services — already CB-wrapped |
| Queues (BullMQ) | `shared/messaging` | `@InjectQueue('name')` | Heavy/async work (AI batch, exports >10k rows, email blast) |
| WebSockets | `shared/websockets` | `WsRoomsService` + `@WebSocketGateway()` on a `{module}.gateway.ts` | Real-time broadcasts from a CRUD service after a mutation. JWT on handshake handled by `ws-jwt.middleware`. Multi-pod via `redis-io.adapter`. |

> **Rule:** A CRUD module stays CRUD when it consumes shared infra. It only upgrades to `.claude/skills/ARQUITECTURE-NEST/SKILL.md` when its **domain logic** outgrows "validate + save".

---

## ⬆️ Upgrade Triggers — migrate to `ARQUITECTURE-NEST/SKILL.md` when

- You need **domain events** (e.g. `category.created` triggers something elsewhere)
- You need **cross-context coordination** (ACL adapters)
- Business rules grow beyond "validate + save" (state machines, approval flows, multi-step workflows)
- Any service method exceeds ~20 lines of logic
- The aggregate needs invariants enforced in one place (Value Objects, factories)

> ❌ Do NOT upgrade just because you need: exports, WebSockets, AI calls, FastAPI integration, audit log, backup. Those are **shared/ infra**, not architecture decisions — see the table above.

The repository and DTO layers migrate as-is — no rewrite needed.
