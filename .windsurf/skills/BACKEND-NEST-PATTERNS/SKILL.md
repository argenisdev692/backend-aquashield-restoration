---
description: Reusable NestJS service patterns — DRY helpers, findOrFail, singleton guards, repository return-type rules. Apply to every CRUD service before writing methods.
globs: src/modules/**/*.service.ts, src/modules/**/*.repository.ts
---

# BACKEND-NEST-PATTERNS — NestJS Service DRY Patterns (2026)

> **Authority**: Reusable coding patterns for NestJS CRUD services and repositories.
> **Scope**: Any module using the Service/Repository (CRUD) layout.
> **Complements**: `.windsurf/skills/ARCHITECTURE-NEST-CRUD/SKILL.md` (structure) and `.windsurf/skills/BACKEND-NEST/SKILL.md` (stack rules).

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

## Pattern 4 — `deleteFile` side effects: always wrapped in try-catch

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

## Quick Reference — when to apply each pattern

| Situation | Pattern |
|---|---|
| Any service method that reads a record and needs it to exist | `findOrFail` (#1) |
| Repository `update()` return type | `Promise<Entity>` — never nullable (#2) |
| Entity that must be unique platform-wide (e.g. company, config) | `existsAny()` + `ConflictException` (#3) |
| Delete entity that has an associated storage file | try-catch wrapper (#4) |

---

## Rules (NEVER break)

```
✅ ONE findOrFail per service — never repeat the null-check block
✅ repository.update() returns Promise<Entity>, not Promise<Entity | null>
✅ existsAny() for singleton guards — not raw DB unique constraint error
✅ Storage deletion always wrapped in try-catch — never rethrows

❌ Copy-pasting if (!result) throw new NotFoundException(...) across methods
❌ Returning null from repository.update() — Prisma throws P2025 instead
❌ Catching P2025 Prisma errors in the service to produce NotFoundException — use findOrFail pre-check
❌ Letting a failed file delete block the entity operation
```
