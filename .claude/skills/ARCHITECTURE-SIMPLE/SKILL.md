---
description: Directory structure for simple NestJS modules — lookups, configs, tags/categories (8-10 files). NO CQRS, NO domain layer, NO ports inside modules. Use for modules with ≤5 fields and no business rules beyond "validate + save". For CRUDs with business logic → see `.claude/skills/ARCHITECTURE-DEFAULT/SKILL.md`. For complex bounded contexts → see `.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md`.
globs: src/modules/**
---

# ARCHITECTURE-SIMPLE — Flat CRUD for Lookups/Configs (2026)

> **Authority**: SINGLE SOURCE OF TRUTH for simple lookup/config modules.
> **Pattern**: Controller → Service → Repository. No CQRS, no Use Cases, no domain events, **no cache, no audit, no exports, no bulk operations, no soft-delete visibility, no users/auth response shape**. Any of those features is an upgrade trigger to `.claude/skills/ARCHITECTURE-DEFAULT/SKILL.md`.
> **When to use this**: lookups, configs, tags/categories/statuses, any module with ≤5 fields and no business rules beyond "validate + save".
> **For CRUDs with business logic (cache + audit + exports + bulk + soft-delete visibility)**: use `.claude/skills/ARCHITECTURE-DEFAULT/SKILL.md`.
> **For complex bounded contexts**: use `.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md`.
> **Coding patterns for the Service/Repository → see `.claude/skills/BACKEND-NEST-PATTERNS/SKILL.md`.**
> **Stack syntax (Zod, Prisma, Swagger, logging) → see `.claude/skills/BACKEND-NEST/SKILL.md`. Ignore its UseCase / CQRS sections — they apply to ENTERPRISE modules only.**
> **Security baseline → see `.claude/skills/OWASP/SKILL.md`. SIMPLE modules still apply: deny-by-default guards (`JwtAuthGuard` + `CaslGuard`), Zod v4 validation at the edge, Prisma parameterized queries (OWASP #3), `ParseUUIDPipe` on `:id` params (API #1 BOLA), pagination caps on lists (API #4).**

---

## 🧭 Quick Decision Guide

> **See [`.claude/skills/ARCHITECTURE-DECISION-GUIDE.md`](../ARCHITECTURE-DECISION-GUIDE.md) for the complete decision matrix.**

---

## 📁 Flat CRUD Module Structure

```
src/modules/{module}/
├── {module}.module.ts                 # Module wiring: controller + service + repository
├── {module}.controller.ts             # HTTP only — guards, Swagger, ZodValidationPipe, calls Service
├── {module}.service.ts                # Orchestration — findOrFail, calls Repository
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

> **No `domain/`, no `application/`, no `infrastructure/` folders. No `*.command.ts`, no `*.handler.ts`, no `CommandBus`/`QueryBus`, no `*.domain-event.ts`.** Those belong to `.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md` and appear only after an upgrade trigger.

---

## 📄 File Responsibilities

### `{module}.entity.ts`
Plain TypeScript interface — the shape of the domain object returned by the Service. No NestJS, no Prisma, no decorators. Always includes `id`, `createdAt`, `updatedAt`. Nullable fields typed as `T | null`, never `T | undefined`.

> **`entity.ts` ↔ `aggregate.ts` mapping (read this).** This file is the flat-CRUD counterpart of the full architecture's `domain/entities/{module}.aggregate.ts` (see `.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md`). It is intentionally an **anemic data shape**: a CRUD module has no domain invariants, so business rules live in the Service, not here. Do **NOT** add behavior, factory `create()`, or invariants to this interface — the moment you need them, that is an upgrade trigger: the `entity.ts` becomes a rich `{module}.aggregate.ts` and the module moves to the Hex/DDD layout.

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
- `delete(id)` → `Promise<void>` (hard delete; soft delete lives in DEFAULT)
- `existsAny()` → `Promise<boolean>` (only when a singleton guard is needed — PATTERNS #3)

Never throws `HttpException`. UUID v7 comes from the DB default (`uuid_generate_v7()`).

> ⚠️ `bulkDelete` / `bulkRestore` / `restore` / soft-delete repository methods do NOT belong in a SIMPLE module. The moment the UI needs them, upgrade to `.claude/skills/ARCHITECTURE-DEFAULT/SKILL.md`.

### `{module}.service.ts`
Orchestration only. Injects the repository, `LoggerService`, `ClsService`. Applies the DRY patterns from `.claude/skills/BACKEND-NEST-PATTERNS/SKILL.md`:

- ONE `private async findOrFail(id)` — throws `NotFoundException` on null (PATTERN #1)
- `existsAny()` + `ConflictException` for singleton entities (PATTERN #3)
- Every public method has an explicit return type and logs INFO with `traceId` from CLS
- If a method exceeds ~20 lines of business logic → that is an upgrade trigger

> ⚠️ A SIMPLE service does NOT inject `IAuditPort`, `CacheService`, `ExportService`, or `ITransactionManager`. The moment you need any of them, upgrade to DEFAULT.

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
  @CheckAbilities({ action: Action.Read, subject: 'CONTENT' })
  findAll(): Promise<Category[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: CategoryResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
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

> Note: no `@CacheTTL` on GET routes — caching belongs to DEFAULT. SIMPLE reads are cheap (lookups/configs) and a stale TTL adds operational complexity without payoff.

---

## 🚫 Out of scope for SIMPLE (upgrade to DEFAULT)

If your module needs **any** of the following, stop and switch to `.claude/skills/ARCHITECTURE-DEFAULT/SKILL.md` — the patterns below all live there, not here:

| Feature | Where it's specified |
|---|---|
| HTTP response cache (`@CacheTTL`) + invalidation | DEFAULT § "Canonical Mutation Pattern" |
| Audit logging (`IAuditPort`) | DEFAULT § "Canonical Mutation Pattern" |
| Transactional writes (`runInTx`) | DEFAULT § "Canonical Mutation Pattern" |
| R2 / storage compound writes | DEFAULT § "Canonical Mutation Pattern" |
| Bulk delete / bulk restore | DEFAULT § "Bulk Delete / Bulk Restore (flat CRUD)" |
| Soft-delete visibility (`withTrashed` / `onlyTrashed`) | DEFAULT § "Soft-delete visibility" |
| Users & Auth response shape (`roles[]` + `permissions[]`) | DEFAULT § "Users & Auth response shape" |
| Export (XLSX / PDF / CSV) | DEFAULT § Examples (`GET /{module}/export`) |

A SIMPLE module that adopts any of these features without migrating to DEFAULT is a documentation violation (mixed-tier).

---

## 🔄 Request Flow (flat CRUD — SIMPLE)

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
                └─► findOrFail() existence check (update/delete) — throws before any side effect
                └─► repository → Prisma → PostgreSQL
        └─► global-exception.filter maps exceptions → RFC 7807
```

> No audit, no cache invalidation, no bulk path, no event emission. A SIMPLE flow stops at the repository.

---

## 📐 Rules (NEVER break)

```
✅ Repository  ← ONLY file that imports PrismaService / generated Prisma types
✅ Service     ← orchestration; ONE findOrFail; throws NotFoundException
✅ Controller  ← injects Service directly; HTTP + Swagger + guards only
✅ DTO         ← Zod v4 schema + inferred type. No class-validator.
✅ Entity      ← plain TypeScript interface. No ORM decorators.
✅ Null returns ← repository returns null (not undefined) when row not found
✅ repository.update() returns Promise<Entity> — never Promise<Entity | null> (PATTERNS #2)

❌ @CacheTTL / IAuditPort / runInTx / ExportService — upgrade to DEFAULT
❌ Bulk endpoints / soft-delete visibility / restore route — upgrade to DEFAULT
❌ CommandBus / QueryBus / @CommandHandler / @QueryHandler — ENTERPRISE only
❌ domain/ application/ infrastructure/ folders — ENTERPRISE only
❌ Domain events / @OnEvent / EventEmitter2 — upgrade to ENTERPRISE first
❌ Controller calling Repository directly — always through Service
❌ Business logic in Controller or Repository — belongs in Service
   (if a Service method exceeds ~20 lines → upgrade to DEFAULT or ENTERPRISE)
❌ Zod schema defined inline in Controller — always in dto/ file
❌ any / unknown return types — always return the typed entity
❌ console.log / console.warn — always use LoggerService with traceId
❌ Repository throwing HttpException — return null, let Service throw
❌ Repeating `if (!x) throw new NotFoundException()` — extract findOrFail (PATTERNS #1)
```

---

## 📦 Shared Infrastructure (consumed by SIMPLE modules)

> SIMPLE modules consume only the minimum cross-cutting concerns. See `.claude/skills/ARCHITECTURE-DECISION-GUIDE.md` for the full `shared/` tree.

| Concern | Folder | Inject in Service as | Use case |
|---|---|---|---|
| Logger | `logger/` (Pino wrapper) | `LoggerService` | Always — never `console.log` |
| Request context | `shared/cls` (`nestjs-cls`) | `ClsService` | traceId / correlationId propagation |
| WebSockets | `shared/websockets` | `WsRoomsService` + `@WebSocketGateway()` on `{module}.gateway.ts` | Optional real-time broadcast after a mutation |

> **Anything else (`shared/cache`, `shared/activity-log`, `shared/export`, `shared/storage`, `shared/messaging`) means you've outgrown SIMPLE.** Upgrade to DEFAULT.

---

## ⬆️ Upgrade Triggers

Escalate to `.claude/skills/ARCHITECTURE-DEFAULT/SKILL.md` when ANY of the following becomes true:

- Module needs `@CacheTTL` on a GET route (cache invalidation in mutations)
- Module needs `IAuditPort` (audit logging in mutations)
- Module needs exports (Excel / CSV / PDF)
- Module needs bulk delete / bulk restore (UI multi-select)
- Module needs soft delete visibility (`withTrashed` / `onlyTrashed`)
- Module needs the Users & Auth response shape (`roles[]` + `permissions[]`)
- Module needs storage compound writes (R2 upload + DB update)
- Module has >5 fields
- Any Service method exceeds ~20 lines of business logic (consider ENTERPRISE if domain invariants apply)

Escalate to `.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md` when:

- Real domain invariants (state machines, calculations cross-entity)
- Domain events required by other bounded contexts
- ACL complex that depends on domain state
- Workflows multi-paso with coordination
