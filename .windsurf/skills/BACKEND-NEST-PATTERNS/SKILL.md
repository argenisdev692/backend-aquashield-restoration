---
description: Reusable NestJS service patterns — DRY helpers, findOrFail, singleton guards, repository return-type rules. Apply to every CRUD service before writing methods.
globs: src/modules/**/*.service.ts, src/modules/**/*.repository.ts
---

# BACKEND-NEST-PATTERNS — NestJS Service DRY Patterns (2026)

> **Authority**: Reusable coding patterns for NestJS CRUD services and repositories.
> **Scope**: Any module using the Service/Repository (CRUD) layout.
> **Complements**: `.windsurf/skills/ARCHITECTURE-SIMPLE/SKILL.md` (structure) and `.windsurf/skills/BACKEND-NEST/SKILL.md` (stack rules).

---

## Pattern 1 — `findOrFail` private helper (MANDATORY in every CRUD service)

**Rule:** Never write `if (!result) throw new NotFoundException(...)` more than once in the same service.
Extract it into a `private async findOrFail(id: string)` helper and call it from every method that needs "get or throw".

### ✅ CORRECT

```typescript
@Injectable()
export class WidgetService {
  async findById(id: string): Promise<Widget> {
    this.logger.info('WidgetService.findById', { traceId: this.cls.get('traceId'), id });
    return this.findOrFail(id);
  }

  async update(id: string, dto: UpdateWidgetDto): Promise<Widget> {
    this.logger.info('WidgetService.update', { traceId: this.cls.get('traceId'), id });
    await this.findOrFail(id);               // existence check
    return this.repository.update(id, dto);  // never null — Prisma throws P2025
  }

  async delete(id: string): Promise<void> {
    const existing = await this.findOrFail(id);
    // ... side effects (e.g. file cleanup)
    await this.repository.delete(id);
  }

  // ─── single source of truth ───────────────────────────────
  private async findOrFail(id: string): Promise<Widget> {
    const result = await this.repository.findById(id);
    if (!result) throw new NotFoundException('Widget not found');
    return result;
  }
}
```

### ❌ FORBIDDEN — repeated null-check blocks

```typescript
async findById(id: string): Promise<Widget> {
  const result = await this.repository.findById(id);
  if (!result) throw new NotFoundException('Widget not found'); // ← duplicated
  return result;
}

async update(id: string, dto: UpdateWidgetDto): Promise<Widget> {
  const result = await this.repository.update(id, dto);
  if (!result) throw new NotFoundException('Widget not found'); // ← duplicated
  return result;
}
```

---

## Pattern 2 — Repository `update()` return type is never `null`

**Rule:** `prisma.<model>.update()` either returns the updated row **or** throws `PrismaClientKnownRequestError` (code `P2025` — record not found). It **never** returns `null`.  
Declaring `Promise<Entity | null>` for `update()` creates dead null-checks in the service.

### ✅ CORRECT

```typescript
// repository
async update(id: string, data: Partial<...>): Promise<Widget> {
  const row = await this.prisma.widget.update({ where: { id }, data });
  return this.mapToEntity(row);
}
```

### ❌ FORBIDDEN

```typescript
// repository — wrong return type
async update(id: string, data: Partial<...>): Promise<Widget | null> { ... }

// service — dead code, null never arrives
const result = await this.repository.update(id, dto);
if (!result) throw new NotFoundException(...); // unreachable
```

**Why it matters:** dead null-checks around `update()` mislead reviewers into thinking `null` is a real outcome and prevent TypeScript from narrowing the type correctly downstream.

---

## Pattern 3 — Singleton entity guard (`ConflictException`)

**Rule:** When a business rule says "only one record of this type can ever exist", enforce it explicitly in `create()` with an `existsAny()` repository method before inserting. Never rely solely on a DB unique constraint for this — the DB error is not a clean HTTP 409.

```typescript
// repository
async existsAny(): Promise<boolean> {
  const count = await this.prisma.widget.count();
  return count > 0;
}

// service
async create(dto: CreateWidgetDto): Promise<Widget> {
  if (await this.repository.existsAny()) {
    throw new ConflictException('Only one Widget registration is allowed.');
  }
  return this.repository.create(dto);
}
```

---

## Pattern 4 — N+1-free repository methods (set-based reads)

**Rule:** Any repository method that operates on a collection of ids — for `findMany` lookups, hydration, bulk mutations — runs in **one** Prisma statement. A Prisma call inside a `for` / `Promise.all(ids.map(...))` loop is the N+1 cliff and is forbidden.
**Reference**: full rationale + the eleven sibling rules (select/omit, take limits, parallel reads, `relationLoadStrategy`, `Prisma.sql`, soft-delete filters) live in `.windsurf/skills/BACKEND-NEST/SKILL.md` § §3.5 — Prisma Query Discipline. This pattern is the concrete repository-layer expression of those rules.

### ✅ CORRECT — `{ id: { in: ids } }` + map in memory

```typescript
async findByIds(ids: string[]): Promise<Widget[]> {
  const rows = await this.prisma.widget.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  return rows.map((r) => this.mapToEntity(r));
}

async bulkDelete(ids: string[]): Promise<{ count: number }> {
  const result = await this.prisma.widget.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data:  { deletedAt: new Date() },
  });
  return { count: result.count };
}
```

### ❌ FORBIDDEN — Prisma call per id

```typescript
async findByIds(ids: string[]): Promise<Widget[]> {
  // N round-trips, no DB-level optimization possible
  return Promise.all(ids.map((id) => this.findById(id)));
}

async bulkDelete(ids: string[]): Promise<void> {
  // N statements, N TX boundaries, N audit cascades
  await Promise.all(ids.map((id) => this.delete(id)));
}
```

**When the service needs entities by id list:** if hydration is for *display only* (read), `findMany({ where: { id: { in: ids } } })` with `select` is enough. If hydration is to *enforce a per-aggregate invariant before a bulk mutation*, that is an upgrade trigger — the operation is no longer a bulk and belongs in a Saga (see `.windsurf/skills/ARCHITECTURE-ENTERPRISE/SKILL.md` § Bulk Delete / Bulk Restore).

---

## Pattern 5 — `deleteFile` side effects: always wrapped in try-catch

**Rule:** Storage/file deletion is a best-effort operation. If it fails the entity record must still be cleaned up. Wrap every file-deletion helper in a try-catch that logs but does NOT rethrow.

```typescript
private async deleteStorageFile(url: string): Promise<void> {
  try {
    const key = this.storage.keyFromUrl(url); // throws if URL is malformed
    await this.storage.delete(key);
  } catch (error) {
    this.logger.error('Failed to delete file from storage', { error });
    // intentionally not rethrown — DB operation proceeds regardless
  }
}
```

---

## Pattern 6 — List endpoints MUST return `{ data, total, page, limit }`

**Rule:** All paginated list endpoints (GET /resource) must return `{ data: T[]; total: number; page: number; limit: number }` instead of just `T[]`. The `total` count enables the frontend to display "X of Y records" and calculate total pages. Use `Promise.all([count(), findMany()])` for parallel execution.

### ✅ CORRECT

```typescript
// repository
async findAll(
  limit = 50,
  skip = 0,
  search?: string,
  trashed: TrashedMode = 'exclude',
): Promise<{ data: Widget[]; total: number }> {
  const where: Prisma.WidgetWhereInput = {
    ...buildTrashedWhere(trashed),
    ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
  };

  const [total, rows] = await Promise.all([
    this.prisma.widget.count({ where }),
    this.prisma.widget.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      skip,
    }),
  ]);

  return {
    data: rows.map((r) => this.mapToEntity(r)),
    total,
  };
}

// service
async findAll(
  limit = 50,
  skip = 0,
  search?: string,
  trashed: TrashedMode = 'exclude',
): Promise<{ data: Widget[]; total: number }> {
  return this.repository.findAll(limit, skip, search, trashed);
}

// controller
@Get()
async findAll(
  @Query() query: ListWidgetDto,
): Promise<{ data: WidgetResponse[]; total: number }> {
  const result = await this.service.findAll(query.limit, query.skip, query.search, query.trashed);
  return {
    data: result.data.map((w) => this.toResponse(w)),
    total: result.total,
  };
}
```

### ❌ FORBIDDEN — returning only array

```typescript
// repository — missing total count
async findAll(...): Promise<Widget[]> {
  const rows = await this.prisma.widget.findMany({ ... });
  return rows.map((r) => this.mapToEntity(r));
}

// controller — frontend cannot calculate total pages
@Get()
async findAll(...): Promise<WidgetResponse[]> {
  return this.service.findAll(...);
}
```

**Why it matters:** Without `total`, the frontend must make a separate API call to count records, or cannot show pagination metadata like "Page 1 of 5" or "Showing 1-20 of 95 records". The backend should provide this information in a single, efficient query using `Promise.all([count(), findMany()])`.

---

## Quick Reference — when to apply each pattern

| Situation | Pattern |
|---|---|
| Any service method that reads a record and needs it to exist | `findOrFail` (#1) |
| Repository `update()` return type | `Promise<Entity>` — never nullable (#2) |
| Entity that must be unique platform-wide (e.g. company, config) | `existsAny()` + `ConflictException` (#3) |
| Repository method receiving a list of ids | `{ id: { in: ids } }` set-based query (#4) |
| Delete entity that has an associated storage file | try-catch wrapper (#5) |
| Paginated list endpoint (GET /resource) | Return `{ data, total, page, limit }` (#6) |

---

## Rules (NEVER break)

```
✅ ONE findOrFail per service — never repeat the null-check block
✅ repository.update() returns Promise<Entity>, not Promise<Entity | null>
✅ existsAny() for singleton guards — not raw DB unique constraint error
✅ One Prisma statement per ids[] input — findMany/updateMany/deleteMany with { in: ids }
✅ Storage deletion always wrapped in try-catch — never rethrows
✅ List endpoints return { data, total, page, limit } — use Promise.all([count(), findMany()])

❌ Copy-pasting if (!result) throw new NotFoundException(...) across methods
❌ Returning null from repository.update() — Prisma throws P2025 instead
❌ Catching P2025 Prisma errors in the service to produce NotFoundException — use findOrFail pre-check
❌ Promise.all(ids.map(id => this.findById(id))) or .delete(id) — N+1 cliff (see BACKEND-NEST §3.5)
❌ Letting a failed file delete block the entity operation
❌ List endpoints returning only T[] instead of { data, total, page, limit }
```
