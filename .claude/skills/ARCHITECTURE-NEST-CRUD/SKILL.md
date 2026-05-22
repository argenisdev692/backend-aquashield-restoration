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
> **Security baseline → see `.claude/skills/OWASP/SKILL.md`. Note: the `(2026)` in the heading below is this repo's internal skill-version tag, NOT an OWASP release year — there is no official "OWASP 2026". The enforced baseline is OWASP Top 10:2025 + OWASP API Security Top 10:2023, as defined in the OWASP skill. The cache + audit pattern in this file is what satisfies OWASP control #9 (Logging & Alerting) for flat CRUD modules that opt into audit.**

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
| Export (csv + pdf — both mandatory when present) | Optional (inject `shared/export`) | Yes (dedicated export path) |
| Example | `categories`, `tags`, `statuses`, `contacts`, `users` (CRUD) | `auth`, `projects`, `estimates` |

---

## ✅ Preflight — BEFORE creating ANY module file (BLOCKING)

> **Rule:** when the user asks for a new CRUD module, do **NOT** create `{module}.module.ts`, controller, service, or DTOs until every preflight check below is green. If a check fails, **fix it first**, commit the fix, then start the module. A module without its Prisma model + CASL subject + seeded permissions will fail at runtime and leak half-built scaffolding into the repo.

For module `{module}` with CASL subject `{SUBJECT}` (UPPER_SNAKE, e.g. `BLOG_CATEGORY` for `blog-category`):

### 1. Prisma model exists

Check `prisma/schema/{module}.prisma` (multi-file schema layout).

- ✅ File exists AND contains `model {Module} { … }` with at minimum: `id` (uuid v7 via `dbgenerated("uuid_generate_v7()")`), `createdAt`, `updatedAt`, and (when soft-delete is in scope) `deletedAt`.
- ❌ Missing → create `prisma/schema/{module}.prisma` with the model FIRST. Then run:
  ```bash
  npx prisma generate
  npx prisma db push        # or: npx prisma migrate dev --name add_{module}
  ```
- The model MUST follow the repo rules from `.claude/rules/backend-nest.md`: no `@updatedAt` when the table has a DB trigger; `@map`/`@@map` for snake_case columns; `@@index` on every FK and on soft-delete (`deletedAt`).

### 2. CASL Subject is declared

Check `src/core/access/actions.enum.ts`.

- ✅ The string `'{SUBJECT}'` appears in the `Subjects` union.
- ❌ Missing → add it to the union BEFORE writing the controller:
  ```ts
  export type Subjects =
    | 'USER'
    | …
    | '{SUBJECT}'   // ← new
    | 'ALL';
  ```
- Without this line, `@CheckAbilities({ action, subject: '{SUBJECT}' })` fails type-check and the guard silently denies every request.

### 3. Permission rows are seeded

Check `prisma/seed.ts`.

- ✅ The permission catalogue contains rows for `{module}:read`, `{module}:create`, `{module}:update`, `{module}:delete`, and (when the model has `deletedAt`) `{module}:restore`. Each row uses `subject: '{SUBJECT}'`.
- ❌ Missing → append the rows to the catalogue, then run:
  ```bash
  npx prisma db seed
  ```
- Lookup/config tables (categories, tags, statuses) usually need only `read|create|update|delete`. Skip `restore` if the table has no `deletedAt`.

### 4. Role → permission mapping exists

Still in `prisma/seed.ts`.

- ✅ At least one non-`super-admin` role grants the new permissions explicitly (e.g. `admin` includes `{module}:read|update|delete`). `super-admin` bypasses CASL via `manage:all`, so it does not need rows — but a real admin role does.
- ❌ Missing → wire the new permission names into the relevant role's `permissions[]` in the seed, re-run `npx prisma db seed`.
- For modules that should NOT be visible to a given role, do nothing — deny-by-default applies.

### 5. Confirm before scaffolding

After steps 1–4 pass, state out loud to the user:

> "Preflight green — Prisma model `{Module}` present, subject `{SUBJECT}` declared, permissions `{module}:read|create|update|delete[|restore]` seeded, mapped to roles `[…]`. Proceeding with the flat CRUD module."

Only then create `{module}.module.ts`, controller, service, repository, entity, and DTOs as described below.

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
- `delete(id)` → `Promise<void>` (soft delete when the entity has `deletedAt`; hard delete otherwise)
- `restore(id)` → `Promise<{Module}>` (only when soft delete is enabled — sets `deletedAt = null`)
- `existsAny()` → `Promise<boolean>` (only when a singleton guard is needed — PATTERNS #3)
- `bulkDelete(ids)` → `Promise<{ count: number }>` (single TX `updateMany` for soft delete OR `deleteMany` for hard; see "Bulk Delete / Bulk Restore" section)
- `bulkRestore(ids)` → `Promise<{ count: number }>` (single TX `updateMany` setting `deletedAt = null`)

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

## 🔁 Canonical Mutation Pattern — Transaction + Cache invalidation + Audit log

> **Opt-in, but all-or-nothing.** A flat CRUD module MAY skip cache/audit. The moment it opts into **either** HTTP response caching (`@CacheTTL` on a GET route) **or** audit (`IAuditPort`), **every** state-mutating method (`create`, `update`, `delete`, `restore`, file upload/delete, …) MUST apply the full block below — including the `runInTx` wrapper. Partial adoption is the exact drift this section exists to prevent.

**Fixed order inside every mutation method:**

1. `findOrFail(id)` existence check (skip only for `create`) — on miss it throws **before** any side effect.
2. **Open transaction** with `await this.tx.runInTx(async () => { ... })`. Inside the block:
   - `await this.repository.<write>()` — the DB write.
   - `await this.audit.log({ action, actorId?, resourceType, resourceId }, { strict: true })` — `strict: true` so an audit failure rolls the whole tx back.
3. **Outside** the tx, in this order: `cache.delByPattern(...)` then `logger.info('<Service>.<method> end', ...)`. Side-effects (R2 cleanup, email, websocket emit) never go inside the tx — Postgres cannot roll back a sent email.

**Wiring (no module changes needed):** `shared/cache` `CacheModule`, `shared/activity-log` `ActivityLogModule`, and `shared/database` `DatabaseModule` are all `@Global()`. Inject `CacheService`, `@Inject(AUDIT_PORT) IAuditPort`, and `@Inject(TRANSACTION_MANAGER) ITransactionManager`. The cache key pattern MUST mirror the `CacheTtlInterceptor` scheme `http:{userId}:{originalUrl}` → `http:*:/{controller-route}*`.

```typescript
@Injectable()
export class BlogCategoryService {
  /** Matches the CacheTtlInterceptor key scheme `http:{userId}:{originalUrl}`. */
  private readonly cacheKeyPattern = 'http:*:/blog-categories*';

  constructor(
    private readonly repository: BlogCategoryRepository,
    private readonly cache: CacheService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER) private readonly tx: ITransactionManager,
  ) {
    this.logger.setContext(BlogCategoryService.name);
  }

  async create(userId: string, dto: CreateBlogCategoryDto): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.create start', { traceId, userId });

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.create({ ...dto, userId });
      await this.audit.log(
        {
          action: 'blogcategory.created',
          actorId: userId,
          resourceType: 'BLOG_CATEGORY',
          resourceId: row.id,
        },
        { strict: true },
      );
      return row;
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.create end', { traceId, blogCategoryId: result.id });
    return result;
  }

  async update(id: string, dto: UpdateBlogCategoryDto): Promise<BlogCategory> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('BlogCategoryService.update start', { traceId, id });
    await this.findOrFail(id);

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.update(id, dto);
      await this.audit.log(
        {
          action: 'blogcategory.updated',
          resourceType: 'BLOG_CATEGORY',
          resourceId: id,
        },
        { strict: true },
      );
      return row;
    });

    await this.invalidateCache();
    this.logger.info('BlogCategoryService.update end', { traceId, id });
    return result;
  }

  /** Drops every cached GET response for this resource after a mutation. */
  private async invalidateCache(): Promise<void> {
    await this.cache.delByPattern(this.cacheKeyPattern);
  }
}
```

**Why `runInTx` and not `@Transactional()` on CRUD services?** The Hex/DDD layer uses the decorator because each use case has one `execute()` entrypoint and the boundary is obvious. CRUD services expose many small methods (mutations + readers + bulks + file ops). An explicit `runInTx` block keeps the transactional boundary visible in the diff, prevents accidentally wrapping a read, and makes it trivial to keep cache + side-effects outside the tx without juggling two scopes. Both ultimately route through the same `TransactionHost` under the hood.

**R2 + DB compound writes (replace image/signature):**

1. Upload the new blob to R2 → key in hand.
2. `runInTx`: `repo.update(id, { image: publicUrl })` + `audit.log({ ..., strict: true })`.
3. On tx rejection — best-effort `storage.delete(newKey)` to roll back the orphan blob; rethrow.
4. After tx commits — best-effort `storage.delete(oldKey)`; never throw.

See `companydata.service.ts uploadSignature` for the canonical pattern.

**Unit test contract** (repository + cache + audit + tx all mocked, no real DB/Redis):

- `tx` mock just invokes the callback: `{ runInTx: async <T>(fn) => fn() }`. No need to mock `@Transactional()` because CRUD services don't use the decorator.
- Each mutation asserts `audit.log` called with the right `(entry, { strict: true })` and `cache.delByPattern` called with the exact `http:*:/{route}*` pattern.
- One negative test: a mutation that fails `findOrFail` ⇒ `audit.log` **not** called and `cache.delByPattern` **not** called.

> Reference implementations in this repo: `src/modules/companydata` and `src/modules/blog-category`. `CacheService.delByPattern` uses non-blocking `SCAN` and swallows Redis errors (cache is an optimization, never a hard dependency) — see `.claude/skills/OWASP/SKILL.md` #10 (graceful degradation) and #9 (audit trail).

---

## 🗑️ Bulk Delete / Bulk Restore (flat CRUD)

> **Scope.** A module opts in to bulk operations when the UI exposes multi-select actions (table checkboxes, "delete selected", "restore selected"). Bulk endpoints are **mandatory** for any module with soft delete + a list view of >20 rows — looping N HTTP calls from the client is forbidden (OWASP API #4 unrestricted resource consumption).
>
> **Soft vs hard delete.** Bulk operations follow the same delete strategy as the single-row variant: if the entity has a `deletedAt: DateTime?` column then `delete` and `bulkDelete` set it (and `bulkRestore` clears it); if it does not, both delete paths are hard `deleteMany`. Mixing strategies inside one module is forbidden.

### Contract

```http
POST   /{module}/bulk-delete    body: { ids: string[] }    → 200 { count: number }
POST   /{module}/bulk-restore   body: { ids: string[] }    → 200 { count: number }  (soft delete only)
```

- Method is `POST` (not `DELETE`) because `DELETE` with a request body is non-portable across proxies/clients.
- Response returns the actual number of affected rows — never `204`. The frontend reconciles its grid with `count`.
- Hard limit: `ids.length` validated `min(1).max(100)` in the Zod schema. Larger payloads must be paginated by the client.

### Repository

```typescript
// {module}.repository.ts — single TX, single statement, no N+1
async bulkDelete(ids: string[]): Promise<{ count: number }> {
  const result = await this.prisma.widget.updateMany({
    where: { id: { in: ids }, deletedAt: null },     // skip already-deleted rows
    data:  { deletedAt: new Date() },
  });
  return { count: result.count };
}

async bulkRestore(ids: string[]): Promise<{ count: number }> {
  const result = await this.prisma.widget.updateMany({
    where: { id: { in: ids }, deletedAt: { not: null } }, // skip not-deleted rows
    data:  { deletedAt: null },
  });
  return { count: result.count };
}

// Hard-delete variant (entity has no deletedAt column)
async bulkDelete(ids: string[]): Promise<{ count: number }> {
  const result = await this.prisma.widget.deleteMany({ where: { id: { in: ids } } });
  return { count: result.count };
}
```

> ❌ Never loop `Promise.all(ids.map(id => this.delete(id)))` — N statements, N audit rows, N cache flushes.
> ✅ One `updateMany`/`deleteMany` = one statement, one TX, one audit row, one cache flush.

### Service (Canonical Mutation Pattern — bulk variant)

```typescript
async bulkDelete(ids: string[], actorId: string): Promise<{ count: number }> {
  const traceId = this.cls.get<string>('traceId');
  this.logger.info('WidgetService.bulkDelete start', { traceId, actorId, idsCount: ids.length });

  const { count } = await this.repository.bulkDelete(ids);              // step 1 + 2 fused

  await this.audit.log({                                                // step 3 — ONE row, ids[] in metadata
    action: 'widget.bulk_deleted',
    actorId,
    resourceType: 'WIDGET',
    resourceId: ids.length === 1 ? ids[0] : null,                       // null when multi-target
    metadata: { ids, count },
  });

  await this.invalidateCache();                                         // step 4 — single pattern flush
  this.logger.info('WidgetService.bulkDelete end', { traceId, count });
  return { count };
}

async bulkRestore(ids: string[], actorId: string): Promise<{ count: number }> {
  const traceId = this.cls.get<string>('traceId');
  this.logger.info('WidgetService.bulkRestore start', { traceId, actorId, idsCount: ids.length });

  const { count } = await this.repository.bulkRestore(ids);

  await this.audit.log({
    action: 'widget.bulk_restored',
    actorId,
    resourceType: 'WIDGET',
    resourceId: ids.length === 1 ? ids[0] : null,
    metadata: { ids, count },
  });

  await this.invalidateCache();
  this.logger.info('WidgetService.bulkRestore end', { traceId, count });
  return { count };
}
```

> No per-id `findOrFail` loop. `updateMany`/`deleteMany` is **idempotent** — missing ids are silently skipped and reflected in `count`. Auditing each missing id would leak existence (OWASP API #3 BOLA).

### Controller

```typescript
@Post('bulk-delete')
@HttpCode(200)
@ApiOkResponse({ schema: { example: { count: 3 } } })
@CheckAbilities({ action: Action.Delete, subject: 'WIDGET' })
bulkDelete(
  @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
  @CurrentUser() user: UserJwtPayload,
): Promise<{ count: number }> {
  return this.service.bulkDelete(dto.ids, user.id);
}

@Post('bulk-restore')
@HttpCode(200)
@ApiOkResponse({ schema: { example: { count: 3 } } })
@CheckAbilities({ action: Action.Restore, subject: 'WIDGET' })
bulkRestore(
  @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
  @CurrentUser() user: UserJwtPayload,
): Promise<{ count: number }> {
  return this.service.bulkRestore(dto.ids, user.id);
}
```

### Shared bulk DTO

```typescript
// dto/bulk-ids.dto.ts — reusable across every module that opts in to bulk
export const BulkIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});
export class BulkIdsDto extends createZodDto(BulkIdsSchema) {}
```

> Keep this schema **module-local** (`{module}/dto/bulk-ids.dto.ts`) — do NOT hoist into `shared/` unless three or more modules import the exact same shape. Three is the cheapest threshold for justifying shared code; below that, duplication beats premature abstraction.

### Rules — bulk operations

```
✅ One Prisma statement per bulk call (updateMany / deleteMany) — never a loop of single ops
✅ ONE audit row per bulk call — action ends in _bulk_deleted / _bulk_restored, ids[] in metadata
✅ ONE cache flush per bulk call — same delByPattern as the single-row mutation
✅ Zod max(100) on ids[] — DoS protection (OWASP API #4)
✅ POST /bulk-delete + POST /bulk-restore — never DELETE with body
✅ HTTP 200 with { count } — never 204 (count is meaningful)
✅ Idempotent: missing ids skipped silently (no per-id existence leak)
✅ Action.Restore (CASL) gates bulk-restore — distinct from Action.Delete

❌ Promise.all(ids.map(...)) — N statements, N audit rows, N cache flushes
❌ Per-id findOrFail loop inside bulkDelete — leaks existence + breaks idempotency
❌ Mixing soft and hard delete strategies inside one module
❌ Bulk endpoint without max(100) — unbounded DoS surface
❌ DELETE /{module}?ids=... — query-string bulk ids (URL-length limits, log leaks)
❌ Emitting N domain events for a bulk — emit ONE {module}.bulk_deleted with ids[] payload
```

---

## 🗃️ Soft-delete visibility — `withTrashed` / `onlyTrashed` (flat CRUD)

> **Authority.** This section is the SINGLE SOURCE OF TRUTH for exposing soft-deleted rows on a list / single-get / export endpoint. Any module whose entity has `deletedAt: DateTime?` and a public read path MUST follow this contract verbatim. Modules with hard delete only do not apply.
>
> **Pattern source.** Laravel Eloquent's `Model::query()` / `Model::withTrashed()` / `Model::onlyTrashed()` semantics, ported to a shared NestJS util.

### The shared util (already wired)

```typescript
// src/shared/crud/trashed.util.ts — DO NOT duplicate per module
export type TrashedMode = 'exclude' | 'include' | 'only';

resolveTrashedMode({ withTrashed?, onlyTrashed? }): TrashedMode
buildTrashedWhere(mode): { deletedAt?: null | { not: null } }

// Spread these into any list / single-get / export query DTO
export const trashedFlagsShape = {
  withTrashed: stringBoolean.optional(),
  onlyTrashed: stringBoolean.optional(),
} as const;

// `.refine()` predicate — rejects `withTrashed=true&onlyTrashed=true` at the edge
rejectBothTrashedFlags(data): boolean
BOTH_TRASHED_FLAGS_ERROR: { message, path }
```

> ⚠️ `z.coerce.boolean()` is **forbidden** for these flags — `Boolean('false')` is truthy, so `?withTrashed=false` would silently behave like `true`. Use the exported `stringBoolean` (already inside `trashedFlagsShape`).

### Contract

```http
GET /{module}                              → mode=exclude → deletedAt: null
GET /{module}?withTrashed=true             → mode=include → all rows
GET /{module}?onlyTrashed=true             → mode=only    → deletedAt != null
GET /{module}?withTrashed=true&onlyTrashed=true → 400 BadRequest "Use either withTrashed or onlyTrashed, not both"

GET /{module}/:id                          → only if NOT soft-deleted (404 otherwise)
GET /{module}/:id?withTrashed=true         → return even if soft-deleted (for the restore screen)

GET /{module}/export?withTrashed=true      → export includes soft-deleted rows
GET /{module}/export?onlyTrashed=true      → trash bin export
```

- `mode=exclude` is the **default** on every read path — clients that send no flag never see tombstoned rows.
- `withTrashed` / `onlyTrashed` apply only to **read** routes. They do NOT apply to `create`, `update`, `delete`, `bulkDelete`, or `restore` (those operate on identity, not visibility).
- The single-get variant uses a `boolean` `withTrashed` (no `onlyTrashed`) — there is no "only when trashed" single-fetch use case.

### DTO — Query

```typescript
// dto/widgets-list-query.dto.ts
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  trashedFlagsShape,
  rejectBothTrashedFlags,
  BOTH_TRASHED_FLAGS_ERROR,
} from '../../../shared/crud/trashed.util';

export const WidgetsListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(255).optional(),
    // Laravel-style soft-delete visibility (default: only active rows).
    ...trashedFlagsShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR);

export class WidgetsListQueryDto extends createZodDto(WidgetsListQuerySchema) {}
```

> Reuse the same DTO for the matching `/export` endpoint — never duplicate the shape.

### Repository

```typescript
// {module}.repository.ts
import { buildTrashedWhere, type TrashedMode } from '../../shared/crud/trashed.util';

async findAll(
  limit = 50,
  skip = 0,
  trashed: TrashedMode = 'exclude',
): Promise<Widget[]> {
  const where: Prisma.WidgetWhereInput = {
    ...buildTrashedWhere(trashed),
    // …additional filters spread AFTER buildTrashedWhere, never before
  };
  const rows = await this.prisma.widget.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    skip,
  });
  return rows.map((r) => this.toEntity(r));
}

/** @param trashed when `true`, soft-deleted rows are returned too (Laravel `withTrashed()->find()`). */
async findById(id: string, trashed: boolean = false): Promise<Widget | null> {
  const where: Prisma.WidgetWhereInput = trashed ? { id } : { id, deletedAt: null };
  const row = await this.prisma.widget.findFirst({ where });
  return row ? this.toEntity(row) : null;
}

/** Finds a row regardless of soft-delete state — required to restore tombstoned rows. */
async findByIdIncludingTrashed(id: string): Promise<Widget | null> {
  const row = await this.prisma.widget.findFirst({ where: { id } });
  return row ? this.toEntity(row) : null;
}
```

> The repository takes `TrashedMode` directly — service and controller never re-derive the where-fragment. One source of truth for `deletedAt` filtering: `buildTrashedWhere()`.

### Service

```typescript
async findAll(
  limit = 50,
  skip = 0,
  trashed: TrashedMode = 'exclude',
): Promise<Widget[]> {
  this.logger.info('WidgetService.findAll', {
    traceId: this.cls.get('traceId'),
    limit,
    skip,
    trashed,
  });
  return this.repository.findAll(limit, skip, trashed);
}

async findById(id: string, withTrashed: boolean = false): Promise<Widget> {
  this.logger.info('WidgetService.findById', {
    traceId: this.cls.get('traceId'),
    id,
    withTrashed,
  });
  const result = await this.repository.findById(id, withTrashed);
  if (!result) throw new NotFoundException('Widget not found');
  return result;
}
```

### Controller

```typescript
@Get()
@SkipThrottle()
@ApiOkResponse({ type: [WidgetResponse] })
@ApiQuery({ name: 'limit', required: false, type: Number })
@ApiQuery({ name: 'skip', required: false, type: Number })
@ApiQuery({
  name: 'withTrashed',
  required: false,
  type: Boolean,
  description: 'Include soft-deleted widgets (Laravel `withTrashed()`).',
})
@ApiQuery({
  name: 'onlyTrashed',
  required: false,
  type: Boolean,
  description: 'Return ONLY soft-deleted widgets. Cannot be combined with `withTrashed`.',
})
@CacheTTL(TTL_SECONDS.MEDIUM)
@CheckAbilities({ action: Action.Read, subject: 'WIDGET' })
async findAll(
  @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
  @Query('withTrashed') withTrashedRaw?: string,
  @Query('onlyTrashed') onlyTrashedRaw?: string,
): Promise<WidgetResponse[]> {
  if (withTrashedRaw === 'true' && onlyTrashedRaw === 'true') {
    throw new BadRequestException('Use either withTrashed or onlyTrashed, not both');
  }
  const trashed: TrashedMode =
    onlyTrashedRaw === 'true' ? 'only'
    : withTrashedRaw === 'true' ? 'include'
    : 'exclude';
  return this.service.findAll(limit, skip, trashed);
}

@Get(':id')
@ApiQuery({
  name: 'withTrashed',
  required: false,
  type: Boolean,
  description: 'When `true`, return the widget even if it has been soft-deleted.',
})
@CheckAbilities({ action: Action.Read, subject: 'WIDGET' })
async findOne(
  @Param('id', ParseUUIDPipe) id: string,
  @Query('withTrashed') withTrashedRaw?: string,
): Promise<WidgetResponse> {
  return this.service.findById(id, withTrashedRaw === 'true');
}
```

> When the list DTO is parsed through `ZodValidationPipe` (preferred), the controller receives already-coerced booleans and the `if (withTrashedRaw === 'true' && onlyTrashedRaw === 'true')` guard moves into the Zod `.refine()` — pick **one** validation site per route, never both.

### Response shape

The entity (and its `Response` DTO) MUST expose `deletedAt: string | null` so the frontend can render a "Suspended" / "Trashed" badge. Without it, `?withTrashed=true` becomes useless — the client can't tell active rows from tombstoned ones.

```typescript
export const WidgetResponseSchema = z.object({
  id: z.string().uuid(),
  // …other fields
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Soft-delete tombstone. `null` for active rows; ISO timestamp when tombstoned. */
  deletedAt: z.string().datetime().nullable(),
});
```

### Authorization

| Endpoint | CASL | Why |
|---|---|---|
| `GET /{module}` (default) | `Action.Read` | Standard read |
| `GET /{module}?withTrashed=true` | `Action.Read` | Still a read of the resource — same ability |
| `GET /{module}?onlyTrashed=true` | `Action.Restore` | Trash bin == prelude to restore. Only users who can restore should see it. Prevents leaking the trash via the read permission. |
| `GET /{module}/:id?withTrashed=true` | `Action.Read` | Same as above — single-row variant |
| `POST /{module}/:id/restore` | `Action.Restore` | Already gated by `Action.Restore` |
| `POST /{module}/bulk-restore` | `Action.Restore` | Already gated by `Action.Restore` |

> **Authorization decision (`onlyTrashed`).** A single Controller method MAY use `CheckAbilities` only at the class/method level. To gate `onlyTrashed=true` with `Action.Restore`, prefer **two routes** — `GET /{module}` (Action.Read) and `GET /{module}/trash` (Action.Restore) — over dynamic ability resolution. Keeps Swagger and CASL trivially auditable.

### Cache

- The default `@CacheTTL(...)` on `GET /{module}` keys by `originalUrl` — `?withTrashed=true` and `?onlyTrashed=true` get their own cache entries automatically. No extra work.
- `invalidateCache()` after `delete` / `restore` / `bulkDelete` / `bulkRestore` MUST use the same `http:*:/{module}*` pattern — wildcarding the query string drops every variant in one Redis SCAN.

### OWASP notes

- **API #1 BOLA / API #3 broken property-level auth:** `Action.Restore` gate on `onlyTrashed` prevents a read-only user from enumerating recently deleted rows of resources they no longer have access to.
- **OWASP #3 Injection / API #8 misconfiguration:** never accept arbitrary query strings as a free-form `where` — `buildTrashedWhere()` returns a typed `Prisma.WhereInput` fragment with a closed enum of three values.
- **API #4 unrestricted resource consumption:** the same `limit.max(100)` cap from the standard list query applies — `?onlyTrashed=true` does not unlock unbounded reads.

### Testing

Every service spec for a module with soft delete MUST cover the three modes plus the reject-both case:

```typescript
describe('WidgetService.findAll', () => {
  it.each(['exclude', 'include', 'only'] as const)(
    'forwards trashed mode %s to repository',
    async (trashed) => {
      await service.findAll(20, 0, trashed);
      expect(repo.findAll).toHaveBeenCalledWith(20, 0, trashed);
    },
  );
});

describe('WidgetController list', () => {
  it('rejects withTrashed=true & onlyTrashed=true', async () => {
    await expect(controller.findAll(undefined, undefined, 'true', 'true'))
      .rejects.toThrow(BadRequestException);
  });
});
```

Reference implementations: `src/modules/blog-category` (canonical CRUD) and `src/shared/crud/trashed.util.spec.ts`.

### Rules — soft-delete visibility

```
✅ Use `trashedFlagsShape` + `rejectBothTrashedFlags` in EVERY list/export DTO — never re-roll the schema
✅ Repository accepts `TrashedMode` and calls `buildTrashedWhere(mode)` ONCE per query
✅ Single-get variant takes a boolean `withTrashed` (no `onlyTrashed`)
✅ Response DTO exposes `deletedAt: string | null` whenever the entity is soft-delete-aware
✅ `?onlyTrashed=true` (or a dedicated `/trash` route) is gated by `Action.Restore`, not `Action.Read`
✅ `mode=exclude` is the default — clients that send no flag MUST NOT see tombstoned rows
✅ Bulk-delete / bulk-restore are unaffected — they target ids, not visibility

❌ `z.coerce.boolean()` on `withTrashed` / `onlyTrashed` — use `stringBoolean` (in trashedFlagsShape)
❌ Filtering soft-deleted rows in JS with `.filter(r => !r.deletedAt)` — push into Prisma `where`
❌ Repository exposing `findAllIncludingTrashed()` / `findAllOnlyTrashed()` as separate methods — one method, one `TrashedMode` arg
❌ Reusing the same `?trashed=` param name (the project chose `withTrashed` + `onlyTrashed`)
❌ Sending `withTrashed=true&onlyTrashed=true` — Zod `.refine()` rejects at the edge
❌ Single-get returning soft-deleted by default — `withTrashed=false` is the default
❌ A list endpoint that supports `withTrashed` but the matching `/export` does not (or vice versa)
```

---

## 👤 Users & Auth response shape — roles + permissions

> **Authority.** Every endpoint that returns a user identity MUST expose `roles[]` and `permissions[]` so the frontend can render menus, route guards, and CASL `Ability` instances without an extra round-trip. This applies to `/auth/me`, `GET /users`, and `GET /users/:id`. Auth flows that issue tokens (`/auth/login`, `/auth/refresh`) deliberately do **not** include these arrays — see "What NOT to embed" below.

### Canonical shapes

```typescript
// src/modules/auth/infrastructure/api/presenters/auth.response.ts (already in repo)
export const MeRoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export const MePermissionSchema = z.object({
  action: z.string(),    // 'read' | 'create' | 'update' | 'delete' | 'restore' | 'export' | …
  subject: z.string(),   // 'WIDGET' | 'USER' | 'BLOG_CATEGORY' | …
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

```typescript
// modules/users/.../user.response.ts — list + single-get presenter
export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  // …profile fields
  /** Soft-delete tombstone. `null` for active users. */
  deletedAt: z.string().datetime().nullable(),
  /** Role assignments. Always emitted, even if empty. */
  roles: z.array(MeRoleSchema),
  /** Effective permissions = union of role permissions + direct grants. Flat list. */
  permissions: z.array(MePermissionSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

> **Reuse, don't duplicate.** `MeRoleSchema` / `MePermissionSchema` are the canonical shapes. Import them from the auth presenter — do NOT redefine `UserRoleSchema` / `UserPermissionSchema` per module.

### Endpoints — required projection

| Endpoint | Includes `roles` | Includes `permissions` | Notes |
|---|---|---|---|
| `GET /auth/me` | ✅ effective | ✅ effective | Source of truth for the logged-in user. Frontend builds its `Ability` from this. |
| `GET /users` (list) | ✅ assigned | ✅ effective | Admin grid. `permissions` already collapses role-inherited + direct grants. |
| `GET /users/:id` | ✅ assigned | ✅ effective | Same as list, full detail. |
| `POST /users` (create) | ✅ | ✅ | Echo back so the UI doesn't refetch. Empty arrays allowed. |
| `PATCH /users/:id` | ✅ | ✅ | Same — echo after the write. |
| `POST /auth/login` | ❌ | ❌ | Returns token only. UI calls `/auth/me` after login. |
| `POST /auth/refresh` | ❌ | ❌ | Same. |

> **Effective vs assigned.** `roles[]` lists the role rows the user is explicitly attached to. `permissions[]` is the **flattened union** of every permission reachable through those roles plus any direct grants — the frontend should never have to fan-out a role→permission lookup. Compute this once in the repository / read model, not in the controller.

### Read-model contract (flat CRUD — service responsibility)

```typescript
// users.repository.ts
async findById(id: string, trashed: boolean = false): Promise<UserWithAccess | null> {
  const row = await this.prisma.user.findFirst({
    where: trashed ? { id } : { id, deletedAt: null },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
      directPermissions: { include: { permission: true } },
    },
  });
  return row ? this.toReadModel(row) : null;
}

private toReadModel(row: PrismaUserWithJoins): UserWithAccess {
  const roleRows = row.roles.map((r) => r.role);
  const fromRoles = roleRows.flatMap((r) =>
    r.permissions.map((p) => p.permission),
  );
  const fromDirect = row.directPermissions.map((p) => p.permission);
  const merged = new Map(
    [...fromRoles, ...fromDirect].map((p) => [`${p.action}:${p.subject}`, p]),
  );
  return {
    id: row.id,
    email: row.email,
    // …profile fields
    deletedAt: row.deletedAt?.toISOString() ?? null,
    roles: roleRows.map((r) => ({ id: r.id, name: r.name })),
    permissions: [...merged.values()].map((p) => ({
      action: p.action,
      subject: p.subject,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
```

- Deduplicate on the composite key `${action}:${subject}` — a permission inherited from two roles must appear once.
- The repository returns the projection (`UserWithAccess`), the service forwards it untouched, the controller wraps it in `UserResponse`. No re-shaping per layer.

### Security & privacy

- **Never include the role's permission ROWS verbatim** (`{ id, createdAt, …}`) — `{ action, subject }` only. Internal IDs leak permission catalog structure.
- **Never include `passwordHash`, `totpSecret`, `backupCodes`, `mfaSecret`, or any session/refresh token field** on a user listing. The `UserResponseSchema` MUST stay a strict allowlist (Zod `.strict()` if applied at the schema level).
- **`GET /users` is admin-only** — gate with `@CheckAbilities({ action: Action.Read, subject: 'USER' })` AND a CASL rule that scopes the result set by tenant / company in `CaslAbilityFactory`. Returning every user's permission set to an unauthorized actor is the textbook OWASP API #1 BOLA leak.
- **PII in logs:** never `logger.info({ permissions })` — log the count, not the array.

### Cache

- `GET /auth/me` MUST NOT be cached with the default HTTP cache — permissions can change mid-session (role granted, role revoked). Use `@SkipCache()` or a per-user TTL ≤ 60s.
- `GET /users` MAY be cached with `@CacheTTL(TTL_SECONDS.SHORT)`, but **every** write path in the roles/permissions module MUST `cache.delByPattern('http:*:/users*')` and `cache.delByPattern('http:*:/auth/me*')` to evict stale ACL snapshots. Otherwise a revoked permission lingers until TTL.

### OWASP notes

- **API #1 BOLA / #3 BOPLA:** the `permissions[]` array is itself a sensitive surface — it tells an attacker exactly what to probe. Pair every user-listing route with tenant-scoped `CaslAbilityFactory` rules.
- **OWASP #5 Security Misconfiguration:** `roles[]` / `permissions[]` MUST be empty arrays (never `null`, never absent) for users with no assignments — clients should not have to branch on "field missing vs empty".
- **API #9 Improper inventory management:** version the `MePermissionSchema` shape if you ever add fields. The frontend's CASL `Ability` is built directly from this shape — silently adding a field can break route guards.

### Rules — roles & permissions in response

```
✅ MeRoleSchema / MePermissionSchema are the canonical shapes — import, never redefine
✅ GET /auth/me, GET /users, GET /users/:id all emit `roles[]` and `permissions[]` (effective, deduped)
✅ permissions[] is FLATTENED — frontend never walks role.permissions[]
✅ Empty assignments → empty arrays, never null, never absent
✅ Permission rows expose `{ action, subject }` only — no internal IDs
✅ Every write that touches user_roles / role_permissions / user_permissions invalidates
   `http:*:/users*` AND `http:*:/auth/me*`

❌ Returning roles[] / permissions[] from /auth/login or /auth/refresh — token endpoints stay lean
❌ Returning passwordHash, totpSecret, backupCodes, mfaSecret, refreshToken on a user response
❌ Returning role.permissions[] nested — flatten in the read-model
❌ Caching /auth/me with the default TTL (permissions can change mid-session)
❌ Logging the full `permissions` array — log count only
❌ Per-module re-derivation of UserRoleSchema / UserPermissionSchema — import the canonical ones
```

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
        └─► [WRITE] service.create(dto) / update(id,dto) / delete(id) / restore(id)
                └─► findOrFail() existence check (update/delete/restore) — throws before any side effect
                └─► repository → Prisma → PostgreSQL
                └─► IAuditPort.log() — required on EVERY mutation once the module opts into audit
                └─► invalidateCache() — required on EVERY mutation once the module opts into @CacheTTL
        └─► [BULK]  service.bulkDelete(ids) / bulkRestore(ids)
                └─► repository.updateMany / deleteMany (single TX, idempotent — no per-id existence check)
                └─► ONE IAuditPort.log() row, action=*.bulk_deleted/*.bulk_restored, ids[] in metadata
                └─► ONE invalidateCache() call — same pattern as single-row mutation
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
❌ Opting into @CacheTTL or IAuditPort but applying it to only SOME mutations — all-or-nothing (Canonical Mutation Pattern)
❌ audit.log() or invalidateCache() running before the repository write, or before findOrFail passes
❌ Using request body for audit `resourceId` — always the route param
```

---

## 📦 Shared Infrastructure (consumed by any flat CRUD module)

> Cross-cutting concerns live in `src/shared/` and are injected straight into the Service — using them does NOT force an upgrade. See `.claude/skills/ARCHITECTURE-NEST/SKILL.md` for the full `shared/` tree.

| Concern | Folder | Inject in Service as | Use case |
|---|---|---|---|
| Logger | `shared/logger` (or `nestjs-pino`) | `LoggerService` | Always — never `console.log` |
| Request context | `shared/cls` (`nestjs-cls`) | `ClsService` | traceId / correlationId propagation |
| Activity log | `shared/activity-log` | `@Inject(AUDIT_PORT) IAuditPort` | Opt-in: manual `audit.log()` in EVERY mutation method (see Canonical Mutation Pattern) |
| HTTP cache | `shared/cache` | `CacheService` | Opt-in: `@CacheTTL` on GET routes ⇒ `cache.delByPattern()` in EVERY mutation method (see Canonical Mutation Pattern) |
| CSV + PDF export (both mandatory) | `shared/export` | `ExportService` | Inject in Service, call from `GET /{module}/export?format=csv\|pdf` — both formats MUST be reachable |
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

> ❌ Do NOT upgrade just because you need: exports, WebSockets, AI calls, FastAPI integration, audit log, cache invalidation, backup. Those are **shared/ infra**, not architecture decisions — see the table above.

The `{module}.repository.ts` and `dto/` layers migrate as-is — only the Service splits into Command/Query Handlers. Do NOT pre-emptively scaffold `domain/application/infrastructure` for modules that have not yet hit an upgrade trigger.
