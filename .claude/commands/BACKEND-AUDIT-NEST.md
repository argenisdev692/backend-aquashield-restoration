---
description: Audits a NestJS 11 / TypeScript module against architecture, security, audit & test rules. Generates a FAIL/PASS checklist, auto-fixes violations, then re-verifies until 100% score.
---

# BACKEND AUDIT AGENT — NestJS 11 + TypeScript 5.x

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

**Use Case Structure (BACKEND-NEST.md §2)**

- [ ] Every write operation lives in a dedicated UseCase class in `application/use-cases/`
- [ ] Every read operation lives in a dedicated UseCase class in `application/use-cases/`
- [ ] Every UseCase is `@Injectable()` with a single `execute()` method
- [ ] Write UseCases return `void` or scalar ID — never full entities or read models
- [ ] Read UseCases NEVER call `IAuditPort.log()`
- [ ] All UseCases registered in `providers[]` of their module
- [ ] `@nestjs/cqrs` is installed but NOT imported in any module by default — if a Use Case imports `CommandBus`/`QueryBus`/`EventBus`, the PR must include an explicit justification per bounded context

**Architecture (`.claude/skills/ARQUITECTURE-NEST/SKILL.md`)**

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

**Validation & APIs (BACKEND-NEST.md §1)**

- [ ] Zod v4 used for ALL input validation — `import { z } from 'zod'` (the `zod/v4` legacy subpath is unnecessary in `zod@^4`)
- [ ] `class-validator` and `class-transformer` NOT imported anywhere
- [ ] `ZodValidationPipe` applied on controller mutation routes or globally via `APP_PIPE`
- [ ] Env vars validated with Zod schema at bootstrap
- [ ] `@nestjs/graphql` is NOT imported — REST endpoints only

**Swagger / OpenAPI (BACKEND-NEST.md §1)**

- [ ] `patchNestjsSwagger()` called in `main.ts` BEFORE `SwaggerModule.createDocument()`
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
