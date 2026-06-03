---
description: Audits a NestJS 11 / TypeScript module against architecture, security, audit & test rules. Generates a FAIL/PASS checklist, auto-fixes violations, then re-verifies until 100% score.
---

# BACKEND AUDIT AGENT — NestJS 11 + TypeScript 5.x

## PHASE 0 — DETECT ARCHITECTURE (decide which checklist applies)

Before auditing, classify the module into exactly ONE of THREE layouts and audit it ONLY against that layout's rules. Use `.windsurf/skills/ARCHITECTURE-DECISION-GUIDE.md` for the canonical decision matrix.

- **SIMPLE — flat lookup/config** — files are `{module}.module/controller/service/repository/entity.ts` + `dto/`, NO `domain/ application/ infrastructure/` folders, NO `CommandBus`/`QueryBus`, NO cache/audit/exports/bulk operations, ≤5 fields. → Audit against `.windsurf/skills/ARCHITECTURE-SIMPLE/SKILL.md` + `.windsurf/skills/BACKEND-NEST-PATTERNS/SKILL.md`. Apply **[FLAT CRUD ONLY]** + **[SIMPLE ONLY]**; skip **[DEFAULT ONLY]** and **[FULL Hex/DDD ONLY]**.
- **DEFAULT — flat CRUD with business logic** — same flat folder shape as SIMPLE PLUS the Canonical Mutation Pattern (tx + audit + cache), bulk delete/restore, soft-delete visibility, exports, optional users/auth response shape. 10–12 files. → Audit against `.windsurf/skills/ARCHITECTURE-DEFAULT/SKILL.md` + `.windsurf/skills/BACKEND-NEST-PATTERNS/SKILL.md`. Apply **[FLAT CRUD ONLY]** + **[DEFAULT ONLY]**; skip **[SIMPLE ONLY]** and **[FULL Hex/DDD ONLY]**.
- **ENTERPRISE — Hex/DDD (full)** — module has `domain/ application/ infrastructure/` with UseCases (or opt-in `CommandBus`/`QueryBus`). → Audit against `.windsurf/skills/ARCHITECTURE-ENTERPRISE/SKILL.md`. Apply **[FULL Hex/DDD ONLY]**; skip every **[FLAT CRUD …]** tag.

State the detected layout (SIMPLE / DEFAULT / ENTERPRISE) at the top of the report. A module that mixes layouts is an automatic ❌ FAIL (`backend-nest.md` forbids mixing styles in one module). Sections tagged **[ALL]** apply to every module regardless of layout.

> **Note on `[FULL Hex/DDD ONLY]` CQRS items.** Hex/DDD modules default to the UseCase pattern (one `@Injectable()` per operation, controller injects UseCase directly). `CommandBus`/`QueryBus` are OPT-IN per bounded context. CQRS-specific checklist lines (`@CommandHandler`, `@QueryHandler`, `CommandBus` dispatch) are ✅ N/A for a UseCase-pattern module — replace "Handler" with "UseCase" and verify the equivalent rule.

---

## PHASE 1 — AUDIT (produce checklist)

Before starting the audit, you MUST:

1. Search the web to verify the latest stable versions of all packages in `BACKEND-NEST.md §11`.
2. Search the web to confirm any NestJS 11 breaking change relevant to the module being audited.

Then analyze the indicated module against ALL rules below.
For each item mark ✅ PASS, ❌ FAIL (with `file:line` and brief description), or ⚠️ WARN.

---

### Required Checklist

**TypeScript Strict (BACKEND-NEST.md §0)**

- [ ] `"strict": true` in `tsconfig.json` affects all files in module
- [ ] No `any` type anywhere — use `unknown` + Zod narrowing
- [ ] No `@ts-ignore` or `@ts-expect-error` (unless documented exception)
- [ ] Every public method has an explicit return type annotation
- [ ] No `as any` or `as unknown as X` casts without justification comment

**Use Case (or opt-in CQRS Handler) Structure — [FULL Hex/DDD ONLY] (BACKEND-NEST.md §2)**

- [ ] Every write operation lives in a dedicated UseCase class in `application/use-cases/` (or, if CQRS is opted into, a `@CommandHandler` in `application/commands/handlers/`)
- [ ] Every read operation lives in a dedicated UseCase class in `application/use-cases/` (or `@QueryHandler` if CQRS is opted into)
- [ ] Every UseCase is `@Injectable()` with a single `execute()` method
- [ ] Write UseCases return `void` or scalar ID — never full entities or read models
- [ ] Read UseCases NEVER call `IAuditPort.log()`
- [ ] All UseCases (or Handlers) registered in `providers[]` of their module
- [ ] `@nestjs/cqrs` is installed but OPT-IN per bounded context — if a UseCase imports `CommandBus`/`QueryBus`/`EventBus`, the module README/comment must include an explicit justification (saga, multiple handlers, etc.). Otherwise controllers inject UseCases directly

**Architecture — Hexagonal layering — [FULL Hex/DDD ONLY] (`.windsurf/skills/ARCHITECTURE-ENTERPRISE/SKILL.md`)**

- [ ] Module lives in `src/modules/{name}/` with `domain/`, `application/`, `infrastructure/`
- [ ] `domain/` has ZERO imports from NestJS, Prisma (`@prisma/client` or generated client), or any `infrastructure/` file
- [ ] `application/use-cases/` imports ONLY from `domain/` and port interfaces
- [ ] `infrastructure/` is the ONLY layer with NestJS decorators, Prisma imports
- [ ] Mapper is the ONLY contact between domain entity and Prisma row
- [ ] Port interfaces defined in `domain/ports/` with `I` prefix
- [ ] DI Symbol tokens defined (e.g. `export const PROJECT_REPOSITORY = Symbol(...)`)
- [ ] Module binds `Symbol → implementation` in `providers[]`
- [ ] Domain events are plain TS classes in `domain/events/` — no framework dependency
- [ ] Event listeners live in `infrastructure/event-listeners/` with `@OnEvent()`

**Flat CRUD Architecture — [FLAT CRUD ONLY] (`.windsurf/skills/ARCHITECTURE-SIMPLE/SKILL.md` + `BACKEND-NEST-PATTERNS`)**

- [ ] Files limited to `{module}.module/controller/service/repository/entity.ts` + `dto/` (optional `{module}.gateway.ts`)
- [ ] NO `domain/ application/ infrastructure/` folders, NO `*.command.ts` / `*.handler.ts`
- [ ] NO `CommandBus` / `QueryBus` / `@CommandHandler` / `@QueryHandler` / `CqrsModule`
- [ ] NO domain events / `@OnEvent` / `EventEmitter2` (those require an upgrade)
- [ ] Controller injects the **Service** directly — never the repository, never a bus
- [ ] Repository is the ONLY file importing `PrismaService` / generated Prisma types
- [ ] Repository returns entity types (never raw Prisma rows); `findById` returns `Entity | null` (never `undefined`); `update` returns `Promise<Entity>` (never nullable — Prisma throws `P2025`)
- [ ] `{module}.entity.ts` is a plain TS interface — no behavior, no decorators, nullable as `T | null`
- [ ] Service has exactly ONE `findOrFail()` helper — no duplicated `if (!x) throw NotFoundException` (PATTERNS #1)
- [ ] Singleton entities guarded with `existsAny()` + `ConflictException` — not a raw DB unique error (PATTERNS #3)
- [ ] Storage/file deletion wrapped in try-catch that logs but never rethrows (PATTERNS #4)
- [ ] No Service method exceeds ~20 lines of business logic (else flag as upgrade trigger to Hex/DDD)
- [ ] Service does NOT catch `P2025` to fake `NotFoundException` — uses `findOrFail` pre-check (PATTERNS)
- [ ] **[SIMPLE ONLY]** No `@CacheTTL`, no `IAuditPort`, no bulk endpoints, no soft-delete visibility, no exports (any of those is an upgrade trigger to DEFAULT)
- [ ] **[SIMPLE ONLY]** Module has ≤5 fields and no business logic beyond "validate + save" (else upgrade to DEFAULT)

**DEFAULT Canonical Mutation Pattern & extras — [DEFAULT ONLY] (`.windsurf/skills/ARCHITECTURE-DEFAULT/SKILL.md`)**

- [ ] Canonical Mutation Pattern applied all-or-nothing: every state-mutating method runs `findOrFail` → `runInTx { repo.write + audit.log({..}, { strict: true }) }` → `cache.delByPattern(...)` → logger.info end
- [ ] `audit.log` calls use `, { strict: true }` so audit failures abort the tx (read paths and login audit keep `strict: false`)
- [ ] Cache key pattern mirrors the `CacheTtlInterceptor` scheme: `http:*:/{controller-route}*`
- [ ] Side-effects (R2 cleanup, email, websocket emit, `eventEmitter.emit`) live OUTSIDE the `runInTx` block
- [ ] R2 + DB compound writes: upload first → tx → on tx failure best-effort delete the new blob → delete the OLD blob only after tx commits
- [ ] Bulk endpoints: `POST /{module}/bulk-delete` and `bulk-restore` use ONE `updateMany`/`deleteMany`, ONE audit row (`{module}.bulk_deleted`), ONE `cache.delByPattern`, return `200 { count }`, `ids[]` capped at `max(100)` (OWASP API #4)
- [ ] Bulk-restore route gated by `Action.Restore` (distinct from `Action.Delete`)
- [ ] Soft-delete visibility: list / single-get / export routes accept `withTrashed` + `onlyTrashed` via `trashedFlagsShape` + `rejectBothTrashedFlags` from `shared/crud/trashed.util.ts`; both true → 400
- [ ] `?onlyTrashed=true` (or `/trash` route) gated by `Action.Restore`, not `Action.Read`
- [ ] Response DTO exposes `deletedAt: string | null` whenever the entity is soft-delete-aware
- [ ] Identity routes (`/auth/me`, `GET /users`, `GET /users/:id`, `POST /users`, `PATCH /users/:id`) emit `roles[]` + flattened deduped `permissions[]` (empty arrays, never `null`); token endpoints (`/auth/login`, `/auth/refresh`) do NOT
- [ ] `passwordHash`, `totpSecret`, `backupCodes`, `mfaSecret`, refresh/session tokens NEVER appear in user projections
- [ ] `/auth/me` uses `@SkipCache()` or per-user TTL ≤ 60s; every ACL mutation `cache.delByPattern`s both `http:*:/users*` AND `http:*:/auth/me*`
- [ ] Export route: registered BEFORE `GET /:id`, `@SkipCache()`, audited with `{module}.export`, reuses the list FilterDTO

**DDD / Hexagonal / UseCase (or opt-in CQRS) conventions — [FULL Hex/DDD ONLY] (`ARCHITECTURE-ENTERPRISE` + BACKEND-NEST.md §1–§3)**

- [ ] `domain/entities/{module}.aggregate.ts` is a rich aggregate (private state, static `create()`, behavior, invariants) — NOT an anemic data interface
- [ ] Invariants live in the Aggregate / Value Objects — VOs use private constructor + static `create()` with validation
- [ ] No business logic leaked into Controller, Handler, or Repository — it belongs in the Aggregate/VO
- [ ] Hexagonal dependency rule holds: `domain/` → nothing; `application/` → only `domain/` + ports; `infrastructure/` → implements ports
- [ ] Ports are `I`-prefixed interfaces in `domain/ports/`, bound via Symbol tokens in the module
- [ ] Default UseCase shape: every operation is an `@Injectable()` UseCase with a single `execute()` method; Controller injects UseCases directly (no `CommandBus`/`QueryBus`). If the module opted into CQRS, the equivalent rule is: writes are `@CommandHandler`, reads are `@QueryHandler`, Controller dispatches via `CommandBus`/`QueryBus` and the opt-in justification is documented in the module
- [ ] Command/Query payload classes are plain TS (no NestJS/infra imports)
- [ ] Domain events are plain TS classes, emitted via `EventEmitter2` AFTER `repo.save()` — never `@nestjs/cqrs` `EventBus`, never before save
- [ ] Mapper is the ONLY Aggregate ↔ Prisma-row ↔ ReadModel contact point
- [ ] `entity ↔ aggregate` mapping respected: no plain `{module}.entity.ts` in a Hex/DDD module (use the aggregate + read-model + mapper + presenter split)

**Code Quality — DRY / KISS / Clean Code — [ALL]**

- [ ] DRY: no copy-pasted blocks (validation, null-checks, mapping) that should be a shared helper/constant
- [ ] DRY: repeated literals/messages extracted to constants — not hardcoded across files
- [ ] KISS: simplest layout that satisfies the rules — flag any Hex/DDD ceremony on a module with no invariants/events/workflows (over-engineering ❌), and any business logic crammed into a flat CRUD Service that has outgrown it (under-engineering ❌)
- [ ] KISS / YAGNI: no speculative abstractions, unused ports, or empty placeholder layers added "for later"
- [ ] Clean Code: descriptive names over comments; every public method has an explicit return type; functions do one thing; no dead code or commented-out blocks
- [ ] Clean Code: no contradictory guidance followed — module matches exactly ONE skill (CRUD or Hex/DDD), never a mix

**Validation & APIs (BACKEND-NEST.md §1)**

- [ ] Zod v4 used for ALL input validation — `import { z } from 'zod'` (the `zod/v4` legacy subpath is unnecessary in `zod@^4`)
- [ ] `class-validator` and `class-transformer` NOT imported anywhere
- [ ] `ZodValidationPipe` applied on controller mutation routes or globally via `APP_PIPE`
- [ ] Env vars validated with Zod schema at bootstrap
- [ ] `@nestjs/graphql` is NOT imported — REST endpoints only

**Swagger / OpenAPI (BACKEND-NEST.md §1)**

- [ ] `cleanupOpenApiDoc(document, { version: '3.0' })` from `'nestjs-zod'` applied BEFORE `SwaggerModule.setup()` (nestjs-zod v5 — `patchNestjsSwagger` removed)
- [ ] `createZodDto` imported from `'nestjs-zod'` — NOT `'nestjs-zod/dto'`
- [ ] Every controller class has `@ApiTags('module-name')`
- [ ] Every authenticated controller class has `@ApiBearerAuth()`
- [ ] POST endpoints use `@ApiCreatedResponse()` (201) — not `@ApiOkResponse()`
- [ ] DELETE endpoints use `@ApiNoContentResponse()` (204) — not `@ApiOkResponse()`
- [ ] GET list endpoints use `@ApiOkResponse({ type: [Dto] })` with array wrapper
- [ ] Every route with `:id` param has `@ApiParam({ name: 'id', type: String, format: 'uuid' })`
- [ ] Every route with `:id` that can 404 has `@ApiNotFoundResponse()`
- [ ] Every mutation route has `@ApiBadRequestResponse({ description: 'Validation failed' })`
- [ ] Response presenter classes use `createZodDto` so Swagger renders output schema
- [ ] `GET /export` route uses `content: { 'application/octet-stream': {} }` in `@ApiOkResponse()`
- [ ] `GET /export` route registered BEFORE `GET /:id` — no route shadowing

**ORM (BACKEND-NEST.md §1)**

- [ ] Prisma 7 used — Drizzle and TypeORM NOT imported anywhere
- [ ] `PrismaClient` imported ONLY from the generator output (`src/generated/prisma/client`) — never from `@prisma/client`
- [ ] Prisma schema lives under `prisma/schema/*.prisma` (multi-file) with the `prisma-client` generator and `@prisma/adapter-pg`
- [ ] For tables whose `updated_at` is managed by a DB trigger, the Prisma model does NOT use `@updatedAt`
- [ ] Mapper used in repository — no raw Prisma rows leaked to domain or application layer
- [ ] Raw SQL is only invoked through `prisma.$queryRaw` with `Prisma.sql` tagged templates or TypedSQL — never via string concatenation

**Audit / Observability (BACKEND-NEST.md §4, §5)**

- [ ] Every Write UseCase calls `IAuditPort.log()` with correct `action` string
- [ ] Audit action follows naming: `{module}.{past_tense_verb}` (e.g. `projects.approved`)
- [ ] NEVER log: `password`, `token`, `apiKey`, `secret`, `authorization`
- [ ] Every Write UseCase logs INFO at START of `execute()`
- [ ] Every Write UseCase logs INFO at END of `execute()`
- [ ] Every Read UseCase logs INFO at START only
- [ ] Every log entry includes `traceId` from `cls.get('traceId')`
- [ ] NO `console.log`, `console.error`, `console.warn` anywhere — use `LoggerService`
- [ ] External adapters log INFO on success, WARN on 4xx, ERROR on 5xx/network failure

**nestjs-cls (BACKEND-NEST.md §1)**

- [ ] `ClsService` injected — `traceId` read via `this.cls.get('traceId')`
- [ ] `traceId` / `correlationId` NOT passed as method parameters
- [ ] `ClsModule.forRoot({ middleware: { mount: true } })` present in `AppModule`
- [ ] `@nestjs-cls/transactional` (Prisma adapter) OR `prisma.$transaction()` used for transactions — no ad-hoc multi-statement sequences without a transaction boundary

**Cache (BACKEND-NEST.md §6)**

- [ ] Every controller GET method has `@CacheTTL(TTL_SECONDS.X)` — no magic numbers
- [ ] Export GET routes have `@SkipCache()` — never cached
- [ ] Write UseCase invalidates relevant cache keys after `repo.save()` succeeds

**Security (BACKEND-NEST.md §8, §14)**

- [ ] `helmet()` applied globally in `main.ts`
- [ ] UUID params validated — `ParseUUIDPipe` on all `:id` route params
- [ ] No raw SQL string concatenation with user input
- [ ] No `eval()` or `Function()` constructor with user input
- [ ] `csrf-csrf` used — not deprecated `csurf`
- [ ] `sanitize-html` used for user-supplied HTML — not deprecated `xss-clean`
- [ ] Every mutation controller uses `@UseGuards(JwtAuthGuard, CaslGuard)` in that order
- [ ] Authorization defined via `@CheckAbilities()` using CASL `Action` and `Subject`
- [ ] `CaslAbilityFactory` correctly loads permissions & conditions from cached DB rows
- [ ] `SUPER_ADMIN` bypass exists ONLY natively in CASL (`can('manage', 'all')`) — no hardcoded checks
- [ ] DTOs filtered through Field-Level Security (`ability.can(action, subjectObject, field)`)
- [ ] No manual role checks (`@Roles()`) if CASL manages the resource authorization

**Exports (BACKEND-NEST.md §7)**

- [ ] Export UseCase reuses same `FilterDTO` as list use case
- [ ] Export route registered BEFORE `/:id` in controller
- [ ] `IAuditPort.log()` called with `action: '{module}.export'`
- [ ] `@SkipCache()` applied on export controller route — export buffers never cached

**Tests (BACKEND-NEST.md §9)**

- [ ] Domain unit tests: zero NestJS/Prisma imports
- [ ] Write UseCase unit tests: `IAuditPort.log()` call verified
- [ ] Write UseCase unit tests: `LoggerService.info()` called at start AND end
- [ ] Read UseCase unit tests: `IAuditPort.log()` NOT called
- [ ] Integration tests: real DB via `@testcontainers/postgresql`
- [ ] E2E tests: full app with `@nestjs/testing` + Supertest

**WebSocket (if applicable)**

- [ ] WS Gateway uses `WsJwtMiddleware` for handshake auth — not HTTP `JwtAuthGuard` directly
- [ ] Room names follow convention: `{resource}:{id}` (e.g. `project:uuid`)
- [ ] `@socket.io/redis-adapter` configured for multi-pod support

---

**Export & Frontend Sync (BACKEND-NEST.md §15)**

- [ ] End-of-Module: TypeScript interfaces exported for frontends (React/Next.js).
- [ ] End-of-Module: OpenAPI JSON generated (from Swagger) exportable to Postman for API testing.

---

## PHASE 2 — FIX

For each ❌ FAIL: apply the minimal fix following the exact rules in `BACKEND-NEST.md`.

Priority order for fixes:

1. Security violations — fix immediately, no exceptions
2. Architecture violations — domain/infra boundary leaks
3. `@nestjs/cqrs` imports — replace with UseCase pattern
4. Missing `IAuditPort.log()` calls — business audit gaps
5. Missing `traceId` in logs — observability gaps
6. Type safety violations — `any`, missing return types

Use web search to confirm correct API if unsure of package version.

---

## PHASE 3 — VERIFICATION CHECKLIST

After all fixes, re-run EVERY item from Phase 1. Expected result:

✅ ALL items PASS
📊 Score: X/Y items — target 100%

If any item remains ❌, repeat Phase 2 → Phase 3 until perfect score.

---

## Audit Actions Reference Table

| Module    | UseCase                        | Expected `action`              | Must audit? |
| --------- | ------------------------------ | ------------------------------ | ----------- |
| projects  | CreateProjectUseCase           | `projects.created`             | ✅ YES      |
| projects  | ApproveProjectUseCase          | `projects.approved`            | ✅ YES      |
| projects  | AssignContractorUseCase        | `projects.contractor_assigned` | ✅ YES      |
| projects  | CompleteProjectUseCase         | `projects.completed`           | ✅ YES      |
| projects  | ExportProjectsUseCase          | `projects.export`              | ✅ YES      |
| projects  | GetProjectByIdUseCase          | —                              | ❌ NO       |
| projects  | GetProjectsListUseCase         | —                              | ❌ NO       |
| estimates | CreateEstimateUseCase          | `estimates.created`            | ✅ YES      |
| estimates | ApproveEstimateUseCase         | `estimates.approved`           | ✅ YES      |
| auth      | LoginUseCase                   | `auth.login`                   | ✅ YES      |
| auth      | LogoutUseCase                  | `auth.logout`                  | ✅ YES      |
| auth      | RefreshTokenUseCase            | `auth.token_refreshed`         | ✅ YES      |
| users     | CreateUserUseCase              | `users.created`                | ✅ YES      |
| users     | SuspendUserUseCase             | `users.suspended`              | ✅ YES      |
| users     | ChangePasswordUseCase          | `users.password_changed`       | ✅ YES      |
| users     | ExportUsersUseCase             | `users.export`                 | ✅ YES      |
| users     | GetUserByIdUseCase             | —                              | ❌ NO       |
