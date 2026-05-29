---
description: Directory structure for NestJS modules with moderate business logic (10-12 files). NO CQRS, NO domain layer, NO ports inside modules — just Service + Repository + Controller with exports, cache, audit. Use for CRUDs with business logic, exports, cache invalidation. For simple lookups → see `.claude/skills/ARCHITECTURE-SIMPLE/SKILL.md`. For complex bounded contexts → see `.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md`.
globs: src/**
---

# ARCHITECTURE-DEFAULT — Simplified Modular Architecture (2026)

> **Authority**: SINGLE SOURCE OF TRUTH for modules with moderate business logic.
> **Pattern**: Controller → Service → Repository. No CQRS, no Domain layer, no ports inside modules.
> **When to use this**: CRUDs with business logic, exports, cache invalidation, audit logging.
> **For simple lookups**: use `.claude/skills/ARCHITECTURE-SIMPLE/SKILL.md`.
> **For complex bounded contexts**: use `.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md`.
> **For coding rules, naming, testing, logging, cache, exports → see `.claude/skills/BACKEND-NEST/SKILL.md`.**
> **For Service/Repository DRY patterns (findOrFail, singleton guard, repo return rules) → see `.claude/skills/BACKEND-NEST-PATTERNS/SKILL.md`. Apply BEFORE writing methods.**
> **Security baseline → see `.claude/skills/OWASP/SKILL.md`. Key hits enforced by this tier: API #1 BOLA (CASL ownership gates on `:id` routes), API #3 BOPLA (strict response allowlist — never echo `passwordHash`/`totpSecret`/`*Token`), API #4 Unrestricted Resource Consumption (`max(100)` on bulk-ids, `take` caps on lists, `@SkipCache()` + `@Throttle()` on export), OWASP #3 Injection (Zod v4 + Prisma parameterized queries only), OWASP #9 Logging Failures (`IAuditPort` with `strict: true` inside `runInTx` + `traceId` from CLS).**

---

## 🧭 Quick Decision Guide

> **See [`.claude/skills/ARCHITECTURE-DECISION-GUIDE.md`](../ARCHITECTURE-DECISION-GUIDE.md) for the complete decision matrix.**

---

## 📁 Full Service Structure

> **Root tree (`src/main.ts`, `app.module.ts`, `core/`, `shared/`, `logger/`, `modules/`) is identical across DEFAULT and ENTERPRISE.** See `.claude/skills/ARCHITECTURE-DECISION-GUIDE.md` for the canonical layout — do not restate per skill. Below is only what is specific to the DEFAULT tier (the `modules/{module}/` template).

---

## 🧩 Module Template — `{YourModule}/` (10-12 archivos máximo)

```
modules/{module}/
├── {module}.module.ts              # Module definition + providers
├── {module}.controller.ts          # HTTP endpoints
├── {module}.service.ts             # Business logic
├── {module}.repository.ts          # Prisma queries
├── dto/
│   ├── create-{module}.dto.ts      # Zod schema for create
│   ├── update-{module}.dto.ts      # Zod schema for update
│   └── {module}-filter.dto.ts      # Zod schema for list filters
└── {module}.spec.ts                # Unit tests
```

**Total: 10-12 archivos** (sin tests, con tests ~13-14)

### Cuándo usar Domain layer completo

Solo si el módulo tiene **invariantes reales** que no son solo "validate + save":

- **Reglas de negocio complejas**: state machines, cálculos complejos, validaciones cross-entity
- **Domain events**: eventos que deben ser publicados y consumidos por otros bounded contexts
- **ACL complejo**: reglas de autorización que dependen del estado del dominio
- **Workflows multi-paso**: procesos que requieren coordinación entre múltiples agregados

Si NO tienes ninguno de estos, usa la estructura simplificada arriba.

---

## 📐 Architecture Rules (NEVER break)

### Simplified Architecture (Service/Repository)

```
✅ Controller → Service → Repository → Prisma
✅ DTOs con Zod v4 para validación
✅ Service contiene business logic
✅ Repository contiene solo queries de Prisma
✅ NO CommandBus/QueryBus (solo si hay CQRS real)
✅ NO Domain layer (solo si hay invariantes)
✅ NO Ports en módulos (solo en shared/external/)

❌ Business logic en Controller
❌ Llamadas directas a Prisma desde Controller
❌ Domain layer sin invariantes reales
❌ Ports/adapters para servicios que no varían
```

### Shared layer

> **See [`.claude/skills/ARCHITECTURE-DECISION-GUIDE.md`](../ARCHITECTURE-DECISION-GUIDE.md) for shared layer rules.**

### General rules

```
✅ TypeScript strict mode
✅ Zod v4 para validación (NO class-validator)
✅ Prisma v7 ORM (NO Drizzle/TypeORM)
✅ nestjs-cls para traceId/correlationId
✅ @nestjs-cls/transactional para transacciones
✅ IAuditPort en write paths que mutan estado
✅ Cache invalidation después de mutations
✅ EventEmitter2 para eventos simples
✅ BullMQ para jobs en infrastructure/jobs/

❌ any types
❌ @ts-ignore
❌ class-validator/class-transformer
❌ console.log (usar LoggerService)
❌ Hardcoded secrets
❌ Circuit breaker en domain/DB calls
❌ Bulk operations como N single calls
```

---

## 🔄 Migration Path

### De Simple → Default

1. **Trigger**: módulo tiene >5 campos o necesita exports/cache/audit
2. **Steps**:
   - Añadir export endpoints (Excel/PDF)
   - Añadir cache invalidation en mutations
   - Añadir audit logging en mutations
   - Mantener estructura Controller → Service → Repository

### De Default → Enterprise

1. **Trigger**: módulo hits uno de los triggers:
   - Invariantes complejas que no caben en Service
   - Domain events requeridos por otros contexts
   - ACL que depende del estado del dominio
   - Workflows multi-paso con coordinación

2. **Steps**:
   - Crear `domain/` con entity + value objects + ports
   - Mover business logic de Service a UseCases (en `application/use-cases/`)
   - Crear `infrastructure/` con repository + mapper
   - Controller llama UseCases directamente (sin Service intermedio)
   - Actualizar tests

---

## 📊 Comparison & Decision Matrix

> **See [`.claude/skills/ARCHITECTURE-DECISION-GUIDE.md`](../ARCHITECTURE-DECISION-GUIDE.md) for comparison table, decision matrix, and anti-patterns.**

---

## 🔁 Canonical Mutation Pattern — Transaction + Cache invalidation + Audit log

> **All-or-nothing.** In DEFAULT, every state-mutating method (`create`, `update`, `delete`, `restore`, file upload/delete, bulk variants, …) MUST apply the full block below — including the `runInTx` wrapper. Partial adoption is the exact drift this section prevents.

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
        { action: 'blogcategory.updated', resourceType: 'BLOG_CATEGORY', resourceId: id },
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

See `companydata.service.ts uploadSignature` and `blog-category.service.ts uploadImage` for the canonical pattern.

**Unit test contract** (repository + cache + audit + tx all mocked, no real DB/Redis):

- `tx` mock just invokes the callback: `{ runInTx: async <T>(fn) => fn() }`. No need to mock `@Transactional()` because CRUD services don't use the decorator.
- Each mutation asserts `audit.log` called with the right `(entry, { strict: true })` and `cache.delByPattern` called with the exact `http:*:/{route}*` pattern.
- One negative test: a mutation that fails `findOrFail` ⇒ `audit.log` **not** called and `cache.delByPattern` **not** called.

> OWASP touch-points: #9 Logging Failures (`strict: true` audit), #10 Mishandling of Exceptional Conditions (tx rollback on audit failure), #5 Security Misconfiguration (graceful Redis degradation).

---

## 🗑️ Bulk Delete / Bulk Restore (flat CRUD)

> **Scope.** A module opts in to bulk operations when the UI exposes multi-select. Bulk endpoints are **mandatory** for any DEFAULT module with soft delete + a list view >20 rows — looping N HTTP calls from the client is forbidden (OWASP API #4 Unrestricted Resource Consumption).
>
> **Soft vs hard delete.** Bulk follows the same delete strategy as the single-row variant. Mixing strategies inside one module is forbidden.

### Contract

```http
POST   /{module}/bulk-delete    body: { ids: string[] }    → 200 { count: number }
POST   /{module}/bulk-restore   body: { ids: string[] }    → 200 { count: number }  (soft delete only)
```

- Method is `POST` (`DELETE` with a request body is non-portable across proxies/clients).
- Response returns `{ count }` — never `204`. The frontend reconciles its grid with `count`.
- Hard limit: `ids.length` validated `min(1).max(100)` in the Zod schema (OWASP API #4 DoS bound).

### Repository (single statement)

```typescript
async bulkDelete(ids: string[]): Promise<{ count: number }> {
  const result = await this.prisma.widget.updateMany({
    where: { id: { in: ids }, deletedAt: null },     // skip already-deleted rows
    data:  { deletedAt: new Date() },
  });
  return { count: result.count };
}

async bulkRestore(ids: string[]): Promise<{ count: number }> {
  const result = await this.prisma.widget.updateMany({
    where: { id: { in: ids }, deletedAt: { not: null } },
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

  const { count } = await this.tx.runInTx(async () => {
    const result = await this.repository.bulkDelete(ids);
    await this.audit.log({
      action: 'widget.bulk_deleted',
      actorId,
      resourceType: 'WIDGET',
      resourceId: ids.length === 1 ? ids[0] : null,
      metadata: { ids, count: result.count },
    }, { strict: true });
    return result;
  });

  await this.invalidateCache();
  this.logger.info('WidgetService.bulkDelete end', { traceId, count });
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
@CheckAbilities({ action: Action.Restore, subject: 'WIDGET' })   // distinct from Action.Delete
bulkRestore(
  @Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto,
  @CurrentUser() user: UserJwtPayload,
): Promise<{ count: number }> {
  return this.service.bulkRestore(dto.ids, user.id);
}
```

### Shared bulk DTO

```typescript
// dto/bulk-ids.dto.ts — keep module-local unless 3+ modules need the same shape
export const BulkIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});
export class BulkIdsDto extends createZodDto(BulkIdsSchema) {}
```

### Rules — bulk operations

```
✅ One Prisma statement per bulk call (updateMany / deleteMany) — never a loop of single ops
✅ ONE audit row per bulk call — action ends in _bulk_deleted / _bulk_restored, ids[] in metadata
✅ ONE cache flush per bulk call — same delByPattern as the single-row mutation
✅ Zod max(100) on ids[] — DoS protection (OWASP API #4)
✅ POST /bulk-delete + POST /bulk-restore — never DELETE with body
✅ HTTP 200 with { count } — never 204
✅ Idempotent: missing ids skipped silently (no per-id existence leak — OWASP API #1/#3)
✅ Action.Restore (CASL) gates bulk-restore — distinct from Action.Delete

❌ Promise.all(ids.map(...)) — N statements, N audit rows, N cache flushes
❌ Per-id findOrFail loop inside bulkDelete — leaks existence + breaks idempotency
❌ Mixing soft and hard delete strategies inside one module
❌ Bulk endpoint without max(100) — unbounded DoS surface
❌ DELETE /{module}?ids=... — query-string bulk ids (URL-length limits, log leaks)
```

---

## 🗃️ Soft-delete visibility — `status` / `withTrashed` / `onlyTrashed` (flat CRUD)

> **Authority.** SINGLE SOURCE OF TRUTH for exposing soft-deleted rows on list / single-get / export endpoints. Any module with `deletedAt: DateTime?` and a public read path MUST follow this contract verbatim. Hard-delete modules do not apply.
>
> **Pattern source.** Two surfaces, one internal mode:
> - `?status=active|suspended|all` — the **canonical, frontend-friendly** API used by the CRM UI (dropdowns, tabs).
> - `?withTrashed=true` / `?onlyTrashed=true` — Laravel Eloquent-style aliases kept for backward parity.
>
> Both surfaces resolve to the same internal `TrashedMode` via `resolveTrashedMode(...)`. Repositories never see `status` — they consume `TrashedMode`.

### The shared util (already wired)

```typescript
// src/shared/crud/trashed.util.ts — DO NOT duplicate per module
export type TrashedMode  = 'exclude' | 'include' | 'only';   // internal
export type EntityStatus = 'active'  | 'suspended' | 'all';  // public (HTTP)

resolveTrashedMode({ status?, withTrashed?, onlyTrashed? }): TrashedMode
buildTrashedWhere(mode): { deletedAt?: null | { not: null } }
entityStatus(deletedAt): 'active' | 'suspended'              // response-shape helper

export const trashedFlagsShape = {
  withTrashed: stringBoolean.optional(),
  onlyTrashed: stringBoolean.optional(),
} as const;

export const statusFlagShape = {
  status: statusQuery,                       // z.enum(['active','suspended','all']).optional()
} as const;

rejectBothTrashedFlags(data): boolean                        // raw flags can't both be true
rejectMixedStatusAndTrashedFlags(data): boolean              // status XOR raw flags
BOTH_TRASHED_FLAGS_ERROR  : { message, path }
MIXED_STATUS_FLAGS_ERROR  : { message, path }
```

> ⚠️ `z.coerce.boolean()` is **forbidden** — `Boolean('false')` is truthy. Use the exported `stringBoolean` (already inside `trashedFlagsShape`). Empty strings (`status=`, `withTrashed=`) normalise to `undefined`.

### Mapping table

| Public (`?status=`) | Raw alias                | Internal `TrashedMode` | Prisma `where` fragment        |
|---------------------|--------------------------|------------------------|--------------------------------|
| `active` (default)  | _absent_                 | `exclude`              | `{ deletedAt: null }`          |
| `suspended`         | `onlyTrashed=true`       | `only`                 | `{ deletedAt: { not: null } }` |
| `all`               | `withTrashed=true`       | `include`              | `{}`                           |

### Contract

```http
GET /{module}                                       → default → active rows
GET /{module}?status=active                         → active rows only
GET /{module}?status=suspended                      → soft-deleted rows only
GET /{module}?status=all                            → both

GET /{module}?withTrashed=true                      → alias of status=all
GET /{module}?onlyTrashed=true                      → alias of status=suspended
GET /{module}?withTrashed=true&onlyTrashed=true     → 400 BadRequest
GET /{module}?status=active&withTrashed=true        → 400 BadRequest (aliases, mixing is ambiguous)

GET /{module}/:id                                   → only if NOT soft-deleted (404 otherwise)
GET /{module}/:id?withTrashed=true                  → return even if soft-deleted (for restore screen)

GET /{module}/export?status=suspended               → trash bin export
```

- `active` is the **default** on every read path.
- `status` / `withTrashed` / `onlyTrashed` apply only to **read** routes. They do NOT apply to writes / bulks / restore (those operate on identity, not visibility).
- Native `status` collision: modules that already own a domain `status` enum (`Post.status: 'draft' | 'published'`, `Order.status: 'pending' | 'paid' | …`) MUST rename it to `postStatus` / `orderStatus` / `lifecycleStatus` before adopting the soft-delete `status` filter. If renaming is infeasible, that module skips `statusFlagShape` and uses only the raw `withTrashed` / `onlyTrashed` flags.

### DTO — Query

```typescript
import {
  statusFlagShape,
  trashedFlagsShape,
  rejectBothTrashedFlags,
  rejectMixedStatusAndTrashedFlags,
  BOTH_TRASHED_FLAGS_ERROR,
  MIXED_STATUS_FLAGS_ERROR,
} from '../../../shared/crud/trashed.util';

export const WidgetsListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(255).optional(),
    ...statusFlagShape,
    ...trashedFlagsShape,
    ...dateRangeShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
  .refine(rejectMixedStatusAndTrashedFlags, MIXED_STATUS_FLAGS_ERROR)
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class WidgetsListQueryDto extends createZodDto(WidgetsListQuerySchema) {}
```

> Reuse the same DTO for `/export` — never duplicate the shape.

### Repository

```typescript
import { buildTrashedWhere, type TrashedMode } from '../../shared/crud/trashed.util';

async findAll(limit = 50, skip = 0, trashed: TrashedMode = 'exclude'): Promise<Widget[]> {
  const where: Prisma.WidgetWhereInput = { ...buildTrashedWhere(trashed) };
  const rows = await this.prisma.widget.findMany({
    where, orderBy: { createdAt: 'desc' }, take: Math.min(limit, 100), skip,
  });
  return rows.map((r) => this.toEntity(r));
}

async findById(id: string, trashed: boolean = false): Promise<Widget | null> {
  const where: Prisma.WidgetWhereInput = trashed ? { id } : { id, deletedAt: null };
  const row = await this.prisma.widget.findFirst({ where });
  return row ? this.toEntity(row) : null;
}
```

### Response shape

The entity (and its `Response` DTO) MUST expose `deletedAt: string | null` so the frontend can render a "Suspended" / "Trashed" badge. SHOULD also expose a derived `status: 'active' | 'suspended'` field (computed in the mapper via `entityStatus(deletedAt)`) so clients render the badge without null-checking.

```typescript
import { entityStatus } from '../../../shared/crud/trashed.util';

export const WidgetResponseSchema = z.object({
  id: z.string().uuid(),
  // …
  status: z.enum(['active', 'suspended']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});

// In the mapper:
function toResponse(row: WidgetRow): WidgetResponse {
  return {
    ...row,
    status: entityStatus(row.deletedAt),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
```

### Authorization

| Endpoint | CASL | Why |
|---|---|---|
| `GET /{module}` (default = `status=active`) | `Action.Read` | Standard read |
| `GET /{module}?status=all` / `?withTrashed=true` | `Action.Read` | Still a read |
| `GET /{module}?status=suspended` / `?onlyTrashed=true` | `Action.Restore` | Trash bin == prelude to restore. Prevents enumerating recently-deleted rows via `Read`. (OWASP API #1 BOLA / #3 BOPLA) |
| `GET /{module}/:id?withTrashed=true` | `Action.Read` | Same as above |
| `POST /{module}/:id/restore` | `Action.Restore` | — |
| `POST /{module}/bulk-restore` | `Action.Restore` | — |

> Prefer **two routes** — `GET /{module}` (Action.Read) and `GET /{module}/trash` (Action.Restore, equivalent to `?status=suspended`) — over dynamic ability resolution. Keeps Swagger + CASL trivially auditable.

### Cache

- Default `@CacheTTL(...)` on `GET /{module}` keys by `originalUrl` — `?withTrashed=true` and `?onlyTrashed=true` get their own cache entries automatically.
- `invalidateCache()` after delete / restore / bulkDelete / bulkRestore uses the `http:*:/{module}*` pattern — wildcarding the query string drops every variant in one Redis SCAN.

### Rules — soft-delete visibility

```
✅ Use `statusFlagShape` + `trashedFlagsShape` + BOTH refines (`rejectBothTrashedFlags`, `rejectMixedStatusAndTrashedFlags`)
✅ Prefer `?status=active|suspended|all` in new frontend code; keep raw flags as backward-compatible aliases
✅ Repository accepts `TrashedMode` and calls `buildTrashedWhere(mode)` ONCE per query
✅ Resolution happens in the service via `resolveTrashedMode({ status, withTrashed, onlyTrashed })`
✅ Single-get variant takes a boolean `withTrashed` (no status / onlyTrashed there)
✅ Response DTO exposes `deletedAt: string | null` AND derived `status: 'active' | 'suspended'` via `entityStatus(deletedAt)`
✅ `?status=suspended` / `?onlyTrashed=true` (or `/trash` route) gated by `Action.Restore`
✅ Default = `status=active` (= `TrashedMode.exclude`)

❌ `z.coerce.boolean()` on `withTrashed` / `onlyTrashed` — use `stringBoolean`
❌ `z.coerce.string()` / inline `z.enum` for `status` — always import `statusFlagShape`
❌ Mixing `?status=` with raw flags on the same request — 400 (handled by the refine)
❌ Repurposing `status` for a native domain enum on the same module without renaming it first
❌ Filtering soft-deleted rows in JS with `.filter(r => !r.deletedAt)` — push into Prisma `where`
❌ Repository exposing `findAllIncludingTrashed()` / `findAllOnlyTrashed()` as separate methods
❌ Single-get returning soft-deleted by default
❌ A list endpoint that supports the filter but the matching `/export` does not
```

---

## 📅 Date-range filter — `start_date` / `end_date` (flat CRUD)

> **Authority.** SINGLE SOURCE OF TRUTH for the between-dates filter on list / single-get-by-criteria / export endpoints. Any module that exposes a timestamp-orderable resource (orders, appointments, posts, invoices, audit rows, …) MUST follow this contract verbatim.
>
> **Pattern source.** Snake-case query params (`start_date`, `end_date`) mirror the CRM frontend's date-picker convention; the internal `DateRange` value object stays in camelCase.

### The shared util (already wired)

```typescript
// src/shared/crud/date-range.util.ts — DO NOT duplicate per module
export interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

export interface DateRangeFlags {
  start_date?: Date;
  end_date?: Date;
}

resolveDateRange({ start_date?, end_date? }): DateRange
buildDateRangeWhere(range, column = 'createdAt'): Record<string, { gte?: Date; lte?: Date }>

export const dateRangeShape = {
  start_date: dateQuery,
  end_date: dateQuery,
} as const;

rejectInvertedDateRange(data): boolean
INVERTED_DATE_RANGE_ERROR: { message, path }
```

> ⚠️ Never use bare `z.coerce.date()` on a query field — `''` (empty input from the frontend) crashes it. Use the exported `dateQuery` (already inside `dateRangeShape`); it preprocesses empty strings to `undefined`.

### Contract

```http
GET /{module}                                       → no filter → all rows in default order
GET /{module}?start_date=2024-01-01                 → createdAt >= 2024-01-01 (since X)
GET /{module}?end_date=2024-01-31                   → createdAt <= 2024-01-31 (up to Y)
GET /{module}?start_date=2024-01-01&end_date=2024-01-31  → inclusive window
GET /{module}?start_date=2024-02-01&end_date=2024-01-01  → 400 BadRequest

GET /{module}/export?start_date=…&end_date=…        → export honours the same window

GET /{module}/:id                                   → identity lookup — IGNORES the filter
```

- Both bounds are **optional** and **inclusive**.
- Empty strings (`start_date=`) are treated as **absent** — the frontend can bind inputs without conditional URL building.
- The filter applies to **read** paths only. Writes / bulks / `:id` lookups operate on identity, never on the date window.

### DTO — Query

```typescript
import {
  dateRangeShape,
  rejectInvertedDateRange,
  INVERTED_DATE_RANGE_ERROR,
} from '../../../shared/crud/date-range.util';

export const WidgetsListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(255).optional(),
    ...trashedFlagsShape,
    ...dateRangeShape,
  })
  .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
  .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

export class WidgetsListQueryDto extends createZodDto(WidgetsListQuerySchema) {}
```

> Reuse the same DTO for `/export` — never duplicate the shape.

### Service

```typescript
import { resolveDateRange } from '../../shared/crud/date-range.util';

async findAll(query: WidgetsListQueryDto): Promise<PaginatedWidgets> {
  const range = resolveDateRange({
    start_date: query.start_date,
    end_date: query.end_date,
  });
  const trashed = resolveTrashedMode(query);
  return this.repository.findAll({
    page: query.page,
    limit: query.limit,
    search: query.search,
    trashed,
    range,
  });
}
```

### Repository

```typescript
import {
  buildDateRangeWhere,
  type DateRange,
} from '../../shared/crud/date-range.util';

async findAll(params: {
  page: number; limit: number; search?: string;
  trashed: TrashedMode; range: DateRange;
}): Promise<PaginatedWidgets> {
  const where: Prisma.WidgetWhereInput = {
    ...buildTrashedWhere(params.trashed),
    ...buildDateRangeWhere(params.range),               // defaults to createdAt
    // …search clauses
  };
  const [rows, total] = await this.prisma.$transaction([
    this.prisma.widget.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.limit,
      take: Math.min(params.limit, 100),
    }),
    this.prisma.widget.count({ where }),
  ]);
  return { items: rows.map((r) => this.toEntity(r)), total };
}
```

> When the module's natural timeline is NOT creation time, pass the column explicitly: `buildDateRangeWhere(params.range, 'scheduledAt')`. Document the chosen column in the route's Swagger description so consumers know what they're filtering on.

### Authorization

The date-range filter does not change CASL — it's a refinement of an existing read. The route already gates with `Action.Read` (or `Action.Restore` for the trash view); `start_date` / `end_date` ride on the same ability.

### Cache

- The default `@CacheTTL(...)` on `GET /{module}` keys by `originalUrl` — every distinct `?start_date=…&end_date=…` combination gets its own Redis entry automatically.
- `invalidateCache()` after mutations already uses `http:*:/{module}*`, which wildcards all query-string variants in one SCAN — no extra invalidation is required.

### Rules — date-range filter

```
✅ Use `dateRangeShape` + `rejectInvertedDateRange` in EVERY list/export DTO of a timeline-able module
✅ Repository accepts `DateRange` and calls `buildDateRangeWhere(range, column?)` ONCE per query
✅ Snake_case at the HTTP boundary (`start_date`, `end_date`); camelCase internally (`startDate`, `endDate`)
✅ Empty strings normalise to `undefined` (handled by `dateQuery`)
✅ Both bounds optional, inclusive on both ends
✅ Default filter column is `createdAt`; override per module with a documented reason

❌ `z.coerce.date()` directly on a query field — use `dateQuery` / `dateRangeShape`
❌ Filtering by date in JS with `.filter(r => r.createdAt >= start)` — push into Prisma `where`
❌ Applying `start_date` / `end_date` to `GET /{module}/:id` — identity lookups ignore the window
❌ Mixing the filter into bulk-delete / bulk-restore — those operate on `ids[]`, not time
❌ Re-defining `dateRangeShape` per module — always import from the shared util
❌ Exposing only one bound (`since=…` / `until=…`) — the canonical names are `start_date` / `end_date`
```

---

## 👤 Users & Auth response shape — roles + permissions

> **Authority.** Every endpoint returning a user identity MUST expose `roles[]` and `permissions[]` so the frontend can build menus, route guards, and CASL `Ability` instances without an extra round-trip. Token-issuing endpoints (`/auth/login`, `/auth/refresh`) deliberately do **not** include these arrays.

### Canonical shapes

```typescript
// src/modules/auth/.../presenters/auth.response.ts (canonical)
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
  roles: z.array(MeRoleSchema),
  permissions: z.array(MePermissionSchema),
  createdAt: z.string().datetime(),
});

// users.response.ts
export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  deletedAt: z.string().datetime().nullable(),
  roles: z.array(MeRoleSchema),
  permissions: z.array(MePermissionSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

> **Reuse, don't duplicate.** `MeRoleSchema` / `MePermissionSchema` are the canonical shapes. Import them — do NOT redefine per module.

### Endpoints — required projection

| Endpoint | `roles` | `permissions` | Notes |
|---|---|---|---|
| `GET /auth/me` | ✅ effective | ✅ effective | Source of truth for the logged-in user |
| `GET /users` (list) | ✅ assigned | ✅ effective | Admin grid |
| `GET /users/:id` | ✅ assigned | ✅ effective | Full detail |
| `POST /users` | ✅ | ✅ | Echo back to avoid refetch. Empty arrays allowed. |
| `PATCH /users/:id` | ✅ | ✅ | — |
| `POST /auth/login` | ❌ | ❌ | Token only. UI calls `/auth/me` after login. |
| `POST /auth/refresh` | ❌ | ❌ | Same. |

> `permissions[]` is the **flattened union** of every permission reachable through the user's roles plus any direct grants — the frontend should never have to fan-out a role→permission lookup. Compute this once in the repository / read model.

### Read-model contract

```typescript
async findById(id: string, trashed: boolean = false): Promise<UserWithAccess | null> {
  const row = await this.prisma.user.findFirst({
    where: trashed ? { id } : { id, deletedAt: null },
    include: {
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      directPermissions: { include: { permission: true } },
    },
  });
  return row ? this.toReadModel(row) : null;
}

private toReadModel(row: PrismaUserWithJoins): UserWithAccess {
  const roleRows = row.roles.map((r) => r.role);
  const fromRoles = roleRows.flatMap((r) => r.permissions.map((p) => p.permission));
  const fromDirect = row.directPermissions.map((p) => p.permission);
  const merged = new Map(
    [...fromRoles, ...fromDirect].map((p) => [`${p.action}:${p.subject}`, p]),
  );
  return {
    id: row.id,
    email: row.email,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    roles: roleRows.map((r) => ({ id: r.id, name: r.name })),
    permissions: [...merged.values()].map((p) => ({ action: p.action, subject: p.subject })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
```

### Security & privacy (OWASP)

- **Never echo `passwordHash`, `totpSecret`, `backupCodes`, `mfaSecret`, or any session/refresh token field.** `UserResponseSchema` MUST be a strict allowlist. (OWASP API #3 BOPLA, OWASP #2 Crypto Failures.)
- **Never include the role's permission ROWS verbatim** (`{ id, createdAt, … }`) — `{ action, subject }` only. Internal IDs leak permission catalog structure. (OWASP API #3 BOPLA.)
- **`GET /users` is admin-only** — `@CheckAbilities({ action: Action.Read, subject: 'USER' })` + tenant-scoped CASL rule. Returning every user's permissions to an unauthorized actor is the textbook OWASP API #1 BOLA leak.
- **PII in logs:** never `logger.info({ permissions })` — log the count, not the array. (OWASP #9 Logging Failures.)

### Cache

- `GET /auth/me` MUST use `@SkipCache()` OR a per-user TTL ≤ 60s — permissions can change mid-session.
- `GET /users` MAY use `@CacheTTL(TTL_SECONDS.SHORT)`, but **every** write touching `user_roles` / `role_permissions` / `user_permissions` MUST `cache.delByPattern('http:*:/users*')` AND `cache.delByPattern('http:*:/auth/me*')`. Otherwise a revoked permission lingers until TTL.

### Rules — roles & permissions

```
✅ MeRoleSchema / MePermissionSchema are canonical — import, never redefine
✅ /auth/me, /users, /users/:id all emit roles[] + flattened deduped permissions[]
✅ Empty assignments → empty arrays, never null, never absent
✅ Permission rows expose { action, subject } only — no internal IDs
✅ Every ACL mutation invalidates both `http:*:/users*` AND `http:*:/auth/me*`

❌ Returning roles[] / permissions[] from /auth/login or /auth/refresh
❌ Returning passwordHash / totpSecret / backupCodes / mfaSecret / refreshToken
❌ Returning role.permissions[] nested — flatten in the read-model
❌ Caching /auth/me with the default TTL
❌ Logging the full `permissions` array — log count only
❌ Per-module re-derivation of UserRoleSchema / UserPermissionSchema
```

---

## 📝 Examples

### Default CRUD (10-12 archivos) - Complete Endpoints

```typescript
// modules/users/users.module.ts
@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}

// modules/users/users.controller.ts
@Controller('users')
@UseGuards(JwtAuthGuard, CaslGuard)
@ApiTags('users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @CacheTTL(TTL_SECONDS.MEDIUM)
  @CheckAbilities({ action: Action.Read, subject: 'User' })
  @ApiOkResponse({ type: [UserResponse] })
  async findAll(@Query() filter: UserFilterDto) {
    return this.usersService.findAll(filter);
  }

  @Get(':id')
  @CacheTTL(TTL_SECONDS.MEDIUM)
  @CheckAbilities({ action: Action.Read, subject: 'User' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: UserResponse })
  @ApiNotFoundResponse()
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @CheckAbilities({ action: Action.Create, subject: 'User' })
  @ApiCreatedResponse({ type: UserResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async create(@Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @CheckAbilities({ action: Action.Update, subject: 'User' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: UserResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @CheckAbilities({ action: Action.Delete, subject: 'User' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.delete(id);
  }

  @Post(':id/restore')
  @CheckAbilities({ action: Action.Restore, subject: 'User' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: UserResponse })
  @ApiNotFoundResponse()
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.restore(id);
  }

  @Post('bulk-delete')
  @CheckAbilities({ action: Action.Delete, subject: 'User' })
  @ApiOkResponse({ schema: { type: 'object', properties: { count: { type: 'number' } } } })
  async bulkDelete(@Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto) {
    return this.usersService.bulkDelete(dto.ids);
  }

  @Post('bulk-restore')
  @CheckAbilities({ action: Action.Restore, subject: 'User' })
  @ApiOkResponse({ schema: { type: 'object', properties: { count: { type: 'number' } } } })
  async bulkRestore(@Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto) {
    return this.usersService.bulkRestore(dto.ids);
  }

  @Get('export')
  @SkipCache()
  @CheckAbilities({ action: Action.Read, subject: 'User' })
  @ApiOkResponse({ content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {} } })
  async export(@Query() filter: UserFilterDto, @Query('format') format: 'xlsx' | 'csv' | 'pdf') {
    return this.usersService.export(filter, format);
  }
}

// modules/users/users.service.ts
@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly cache: CacheService,
    private readonly audit: IAuditPort,
    private readonly exportService: ExportService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async findAll(filter: UserFilterDto) {
    return this.repository.findAll(filter);
  }

  async findOne(id: string) {
    return this.repository.findById(id);
  }

  async create(dto: CreateUserDto) {
    const traceId = this.cls.get('traceId');
    this.logger.info('UsersService.create start', { traceId });

    const result = await this.tx.runInTx(async () => {
      const user = await this.repository.create(dto);
      await this.audit.log({ action: 'users.created', resourceId: user.id }, { strict: true });
      return user;
    });

    await this.cache.delByPattern('users:*');
    this.logger.info('UsersService.create end', { traceId, userId: result.id });
    return result;
  }

  async update(id: string, dto: UpdateUserDto) {
    const traceId = this.cls.get('traceId');
    this.logger.info('UsersService.update start', { traceId, id });

    const result = await this.tx.runInTx(async () => {
      const user = await this.repository.update(id, dto);
      await this.audit.log({ action: 'users.updated', resourceId: id }, { strict: true });
      return user;
    });

    await this.cache.delByPattern('users:*');
    this.logger.info('UsersService.update end', { traceId });
    return result;
  }

  async delete(id: string) {
    const traceId = this.cls.get('traceId');
    this.logger.info('UsersService.delete start', { traceId, id });

    await this.tx.runInTx(async () => {
      await this.repository.delete(id);
      await this.audit.log({ action: 'users.deleted', resourceId: id }, { strict: true });
    });

    await this.cache.delByPattern('users:*');
    this.logger.info('UsersService.delete end', { traceId });
  }

  async restore(id: string) {
    const traceId = this.cls.get('traceId');
    this.logger.info('UsersService.restore start', { traceId, id });

    const result = await this.tx.runInTx(async () => {
      const user = await this.repository.restore(id);
      await this.audit.log({ action: 'users.restored', resourceId: id }, { strict: true });
      return user;
    });

    await this.cache.delByPattern('users:*');
    this.logger.info('UsersService.restore end', { traceId });
    return result;
  }

  async bulkDelete(ids: string[]) {
    const traceId = this.cls.get('traceId');
    this.logger.info('UsersService.bulkDelete start', { traceId, idsCount: ids.length });

    const { count } = await this.tx.runInTx(async () => {
      const result = await this.repository.bulkDelete(ids);
      await this.audit.log({ action: 'users.bulk_deleted', metadata: { ids, count } }, { strict: true });
      return result;
    });

    await this.cache.delByPattern('users:*');
    this.logger.info('UsersService.bulkDelete end', { traceId, count });
    return { count };
  }

  async bulkRestore(ids: string[]) {
    const traceId = this.cls.get('traceId');
    this.logger.info('UsersService.bulkRestore start', { traceId, idsCount: ids.length });

    const { count } = await this.tx.runInTx(async () => {
      const result = await this.repository.bulkRestore(ids);
      await this.audit.log({ action: 'users.bulk_restored', metadata: { ids, count } }, { strict: true });
      return result;
    });

    await this.cache.delByPattern('users:*');
    this.logger.info('UsersService.bulkRestore end', { traceId, count });
    return { count };
  }

  async export(filter: UserFilterDto, format: 'xlsx' | 'csv' | 'pdf') {
    const traceId = this.cls.get('traceId');
    this.logger.info('UsersService.export start', { traceId, format });

    const data = await this.repository.findAll(filter);
    const buffer = await this.exportService.generate(data, format);

    await this.audit.log({ action: 'users.export', metadata: { format, count: data.length } });

    this.logger.info('UsersService.export end', { traceId, format, count: data.length });
    return buffer;
  }
}

// modules/users/users.repository.ts
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: UserFilterDto) {
    return this.prisma.user.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(dto: CreateUserDto) {
    return this.prisma.user.create({ data: dto });
  }

  async update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    return this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string) {
    return this.prisma.user.update({ where: { id }, data: { deletedAt: null } });
  }

  async bulkDelete(ids: string[]) {
    return this.prisma.user.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async bulkRestore(ids: string[]) {
    return this.prisma.user.updateMany({
      where: { id: { in: ids }, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
  }
}
```

### Export Endpoints (PDF/CSV/XLSX)

Export endpoints use `ExportService` from `shared/export/` to generate files in multiple formats:

```typescript
// In controller
@Get('export')
@SkipCache()
@CheckAbilities({ action: Action.Read, subject: 'User' })
async export(@Query() filter: UserFilterDto, @Query('format') format: 'xlsx' | 'csv' | 'pdf') {
  return this.usersService.export(filter, format);
}

// In service
async export(filter: UserFilterDto, format: 'xlsx' | 'csv' | 'pdf') {
  const data = await this.repository.findAll(filter);
  return this.exportService.generate(data, format);
}
```

**Export formats:**
- **XLSX**: Excel spreadsheet (`.xlsx`)
- **CSV**: Comma-separated values (`.csv`)
- **PDF**: PDF document (`.pdf`)

**Rules:**
- Export route registered BEFORE `GET /:id` to avoid route shadowing
- `@SkipCache()` applied — export buffers never cached
- Audit logged with format and count
- Same filter DTO as list endpoint

---

## 🔗 Related Skills

- **`.claude/skills/ARCHITECTURE-SIMPLE/SKILL.md`** — Para lookups/configs simples
- **`.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md`** — Para bounded contexts complejos
- **`.claude/skills/BACKEND-NEST/SKILL.md`** — Reglas de código, naming, testing, logging, cache, exports
- **`.claude/skills/OWASP/SKILL.md`** — Security baseline para APIs
