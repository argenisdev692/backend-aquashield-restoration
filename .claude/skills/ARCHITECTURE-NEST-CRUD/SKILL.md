---
description: Directory structure of each NestJS service — flat Service/Repository (CRUD). Recommended default for solo developers and small/medium features. NO CQRS bus, NO domain/application/infrastructure folders, NO domain events. For complex bounded contexts with domain events, ACL, state machines, or workflows → see `.claude/skills/ARCHITECTURE-NEST/SKILL.md`.
globs: src/modules/**
---

# ARCHITECTURE-NEST-CRUD — Flat Service/Repository Structure (2026)

> **Authority**: SINGLE SOURCE OF TRUTH for simple module file placement.
> **Pattern**: Controller → Service → Repository. No CQRS bus, no Use Cases, no aggregate pattern, no domain events.
> **When to use this**: lookups, configs, tags/categories/statuses, any module with ≤8 fields and no business rules beyond "validate + save".
> **Default for this repo**: start here. Escalate to `.claude/skills/ARCHITECTURE-NEST/SKILL.md` ONLY when an explicit upgrade trigger is met.
> **Coding patterns for the Service/Repository → see `.claude/skills/BACKEND-NEST-PATTERNS/SKILL.md`.**
> **Stack syntax (Zod, Prisma, Swagger, logging, cache) → see `.claude/skills/BACKEND-NEST/SKILL.md`. Ignore its CQRS Command/Query handler sections — they apply to Hex/DDD modules only.**

---

## 🧭 Quick Decision Guide

| Signal | Use this file (flat CRUD) | Use `ARCHITECTURE-NEST/SKILL.md` (Hex/DDD) |
|---|---|---|
| Business rules | None / trivial validations | State machines, invariants, multi-step workflows |
| Events | No | Yes (domain events with real listeners) |
| Cross-context | No | Yes (ACL adapters) |
| Value Objects | No | Yes |
| CQRS bus | No — direct Service call | Yes (`CommandBus`/`QueryBus`) |
| Service method size | ≤ ~20 lines of logic | Logic exceeds ~20 lines → upgrade |
| Export (xlsx/pdf) | Optional (inject `shared/export`) | Yes (dedicated export path) |
| Example | `categories`, `tags`, `statuses`, `contacts`, `users` (CRUD) | `auth`, `projects`, `estimates` |

---

## 📁 Flat CRUD Module Structure

```
src/modules/{module}/
├── {module}.module.ts                 # Module wiring: controller + service + repository
├── {module}.controller.ts             # HTTP only — guards, Swagger, ZodValidationPipe, calls Service
├── {module}.service.ts                # Orchestration — findOrFail, optional IAuditPort, calls Repository
├── {module}.repository.ts             # ONLY file importing PrismaService / generated Prisma types
├── {module}.entity.ts                 # Plain TS interface — domain shape
├── {module}.prisma                    # Prisma model — mirrored under prisma/schema/{module}.prisma
├── {module}.gateway.ts                # OPTIONAL — Socket.io broadcast after a mutation
├── dto/
│   ├── create-{module}.dto.ts         # Zod v4 schema + z.infer<> type
│   └── update-{module}.dto.ts         # CreateSchema.partial()
└── __tests__/
    └── {module}.service.spec.ts       # Unit — repository mocked, no real DB
```

> **No `domain/`, no `application/`, no `infrastructure/` folders. No `*.command.ts`, no `*.handler.ts`, no `CommandBus`/`QueryBus`, no `*.domain-event.ts`.** Those belong to `.claude/skills/ARCHITECTURE-NEST/SKILL.md` and appear only after an upgrade trigger.

---

## 📄 File Responsibilities

### `{module}.entity.ts`
Plain TypeScript interface — the shape of the domain object returned by the Service. No NestJS, no Prisma, no decorators. Always includes `id`, `createdAt`, `updatedAt`. Nullable fields typed as `T | null`, never `T | undefined`.

> **`entity.ts` ↔ `aggregate.ts` mapping (read this).** This file is the flat-CRUD counterpart of the full architecture's `domain/entities/{module}.aggregate.ts` (see `.claude/skills/ARCHITECTURE-NEST/SKILL.md`). It is intentionally an **anemic data shape**: a CRUD module has no domain invariants, so business rules live in the Service, not here. Do **NOT** add behavior, factory `create()`, or invariants to this interface — the moment you need them, that is an upgrade trigger: the `entity.ts` becomes a rich `{module}.aggregate.ts` and the module moves to the Hex/DDD layout. One concept, two names by tier: `entity.ts` = "just data, logic in Service"; `aggregate.ts` = "rich domain, logic inside".

### `dto/create-{module}.dto.ts`
Zod v4 schema exported as `Create{Module}Schema` + inferred type `Create{Module}Dto`. Import `z` from `zod` and `createZodDto` from `nestjs-zod` (never `nestjs-zod/dto`). Export both the schema (for the pipe) and the type (for the service signature).

### `dto/update-{module}.dto.ts`
Always derived from `Create{Module}Schema.partial()`. Never redefine fields. Export `Update{Module}Schema` + `Update{Module}Dto`.

### `{module}.repository.ts`
The ONLY file that imports `PrismaService` / generated Prisma types. Returns **entity types**, never raw Prisma rows (map inline or with a small `private toEntity()`). Contract:

- `findById(id)` → `Promise<{Module} | null>` (null when row absent — never `undefined`)
- `findAll(...)` → `Promise<{Module}[]>`
- `create(dto)` → `Promise<{Module}>`
- `update(id, dto)` → `Promise<{Module}>` (Prisma throws `P2025` if missing — never returns null; see PATTERNS #2)
- `delete(id)` → `Promise<void>`
- `existsAny()` → `Promise<boolean>` (only when a singleton guard is needed — PATTERNS #3)

Never throws `HttpException`. UUID v7 comes from the DB default (`uuid_generate_v7()`).

### `{module}.service.ts`
Orchestration only. Injects the repository, `LoggerService`, `ClsService`, and optionally `IAuditPort` / `ExportService`. Applies the DRY patterns from `.claude/skills/BACKEND-NEST-PATTERNS/SKILL.md`:

- ONE `private async findOrFail(id)` — throws `NotFoundException` on null (PATTERN #1)
- `existsAny()` + `ConflictException` for singleton entities (PATTERN #3)
- Storage/file deletion wrapped in try-catch that logs but never rethrows (PATTERN #4)
- Every public method has an explicit return type and logs INFO with `traceId` from CLS
- If a method exceeds ~20 lines of business logic → that is an upgrade trigger

### `{module}.controller.ts`
HTTP layer only. `@UseGuards(JwtAuthGuard, CaslGuard)` at class level, `@CheckAbilities()` per route, `ZodValidationPipe` on POST/PATCH bodies, `ParseUUIDPipe` on id params, full Swagger decorators. Injects the **Service** directly — never the repository, never a bus. `DELETE` returns `204`. No business logic.

### `{module}.module.ts`
Plain NestJS module — no `CqrsModule`.

```typescript
@Module({
  controllers: [{Module}Controller],
  providers: [{Module}Service, {Module}Repository],
})
export class {Module}Module {}
```

### `{module}.gateway.ts` (optional)
Socket.io gateway for real-time broadcast after a mutation. Allowed in flat CRUD — does NOT force an upgrade.

---

## 🧩 Reference Implementation

```typescript
// {module}.entity.ts
export interface Category {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

// dto/create-category.dto.ts
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateCategorySchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(140),
});
export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}

// dto/update-category.dto.ts
export const UpdateCategorySchema = CreateCategorySchema.partial();
export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}

// category.repository.ts
@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  async findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(data: CreateCategoryDto): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  async update(id: string, data: UpdateCategoryDto): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }
}

// category.service.ts
@Injectable()
export class CategoryService {
  constructor(
    private readonly repository: CategoryRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  findAll(): Promise<Category[]> {
    this.logger.info('CategoryService.findAll', { traceId: this.cls.get('traceId') });
    return this.repository.findAll();
  }

  findById(id: string): Promise<Category> {
    this.logger.info('CategoryService.findById', { traceId: this.cls.get('traceId'), id });
    return this.findOrFail(id);
  }

  create(dto: CreateCategoryDto): Promise<Category> {
    this.logger.info('CategoryService.create', { traceId: this.cls.get('traceId') });
    return this.repository.create(dto);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    this.logger.info('CategoryService.update', { traceId: this.cls.get('traceId'), id });
    await this.findOrFail(id);
    return this.repository.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    this.logger.info('CategoryService.delete', { traceId: this.cls.get('traceId'), id });
    await this.findOrFail(id);
    await this.repository.delete(id);
  }

  // ─── single source of truth ───────────────────────────────
  private async findOrFail(id: string): Promise<Category> {
    const result = await this.repository.findById(id);
    if (!result) throw new NotFoundException('Category not found');
    return result;
  }
}

// category.controller.ts
@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
@UseGuards(JwtAuthGuard, CaslGuard)
export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  @Post()
  @ApiCreatedResponse({ type: CategoryResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @CheckAbilities({ action: Action.Create, subject: 'CONTENT' })
  create(
    @Body(new ZodValidationPipe(CreateCategorySchema)) dto: CreateCategoryDto,
  ): Promise<Category> {
    return this.service.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [CategoryResponse] })
  @CacheTTL(TTL_SECONDS.MEDIUM)
  @CheckAbilities({ action: Action.Read, subject: 'CONTENT' })
  findAll(): Promise<Category[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: CategoryResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CacheTTL(TTL_SECONDS.MEDIUM)
  @CheckAbilities({ action: Action.Read, subject: 'CONTENT' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Category> {
    return this.service.findById(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CategoryResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CheckAbilities({ action: Action.Update, subject: 'CONTENT' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @HttpCode(204)
  @CheckAbilities({ action: Action.Delete, subject: 'CONTENT' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.delete(id);
  }
}
```

> Swagger response shape: declare a `CategoryResponse extends createZodDto(CategoryResponseSchema)` in `dto/` so the output schema renders. See `.claude/skills/BACKEND-NEST/SKILL.md` §1.

---

## 🔄 Request Flow (flat CRUD)

```
HTTP Request
  └─► JwtAuthGuard              (core/guards)
  └─► CaslGuard                 (core/guards) — @CheckAbilities()
  └─► ZodValidationPipe         (core/pipes)  — POST/PATCH only
  └─► Controller (injects Service)
        │
        ├─► [READ]  service.findById(id)
        │       └─► repository.findById() → null → service throws NotFoundException
        │
        └─► [WRITE] service.create(dto) / update(id,dto) / delete(id)
                └─► findOrFail() existence check (update/delete)
                └─► repository → Prisma → PostgreSQL
                └─► optional IAuditPort.log() on mutations (module opts in)
        └─► global-exception.filter maps exceptions → RFC 7807
```

---

## 📐 Rules (NEVER break)

```
✅ Repository  ← ONLY file that imports PrismaService / generated Prisma types
✅ Service     ← orchestration; ONE findOrFail; throws NotFoundException; optional IAuditPort
✅ Controller  ← injects Service directly; HTTP + Swagger + guards only
✅ DTO         ← Zod v4 schema + inferred type. No class-validator.
✅ Entity      ← plain TypeScript interface. No ORM decorators.
✅ Null returns ← repository returns null (not undefined) when row not found
✅ repository.update() returns Promise<Entity> — never Promise<Entity | null> (PATTERNS #2)

❌ CommandBus / QueryBus / @CommandHandler / @QueryHandler — Hex/DDD only
❌ domain/ application/ infrastructure/ folders — Hex/DDD only
❌ Domain events / @OnEvent / EventEmitter2 — upgrade to ARCHITECTURE-NEST first
❌ Controller calling Repository directly — always through Service
❌ Business logic in Controller or Repository — belongs in Service
   (if a Service method exceeds ~20 lines → upgrade to ARCHITECTURE-NEST)
❌ Zod schema defined inline in Controller — always in dto/ file
❌ any / unknown return types — always return the typed entity
❌ console.log / console.warn — always use LoggerService with traceId
❌ Repository throwing HttpException — return null, let Service throw
❌ Repeating `if (!x) throw new NotFoundException()` — extract findOrFail (PATTERNS #1)
```

---

## 📦 Shared Infrastructure (consumed by any flat CRUD module)

> Cross-cutting concerns live in `src/shared/` and are injected straight into the Service — using them does NOT force an upgrade. See `.claude/skills/ARCHITECTURE-NEST/SKILL.md` for the full `shared/` tree.

| Concern | Folder | Inject in Service as | Use case |
|---|---|---|---|
| Logger | `shared/logger` (or `nestjs-pino`) | `LoggerService` | Always — never `console.log` |
| Request context | `shared/cls` (`nestjs-cls`) | `ClsService` | traceId / correlationId propagation |
| Activity log | `shared/activity-log` | `IAuditPort` | Optional: manual call in mutation methods |
| Excel/PDF export | `shared/export` | `ExportService` | Inject in Service, call from `GET /{module}/export?format=xlsx\|pdf` |
| Circuit breaker | `shared/external` (cockatiel) | via `@CircuitBreaker('name')` | Wraps ANY outbound HTTP call |
| AI clients | `shared/external/ai` | `IAiClient` | OpenAI / Anthropic — already CB-wrapped |
| FastAPI client | `shared/external/fastapi` | `IFastapiClient` | Internal Python services — already CB-wrapped |
| Queues (BullMQ) | `shared/messaging` | `@InjectQueue('name')` | Heavy/async work |
| WebSockets | `shared/websockets` | `WsRoomsService` + `@WebSocketGateway()` on `{module}.gateway.ts` | Real-time broadcast after a mutation |

> **Rule:** A flat CRUD module stays flat when it consumes shared infra. It upgrades only when its **domain logic** outgrows "validate + save".

---

## ⬆️ Upgrade Triggers — migrate to `ARCHITECTURE-NEST/SKILL.md` when

- You need **domain events** with real listeners (e.g. `user.created` triggers something elsewhere)
- You need **cross-context coordination** (ACL adapters)
- Business rules grow beyond "validate + save" (state machines, approval flows, multi-step workflows)
- Any Service method exceeds ~20 lines of business logic
- The entity needs invariants enforced in one place (Value Objects, aggregate factories)

> ❌ Do NOT upgrade just because you need: exports, WebSockets, AI calls, FastAPI integration, audit log, backup. Those are **shared/ infra**, not architecture decisions — see the table above.

The `{module}.repository.ts` and `dto/` layers migrate as-is — only the Service splits into Command/Query Handlers. Do NOT pre-emptively scaffold `domain/application/infrastructure` for modules that have not yet hit an upgrade trigger.
