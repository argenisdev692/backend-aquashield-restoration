---
trigger: always_on
---

# [ABSOLUTE] Non-negotiable constraints — ALWAYS apply

- **Language:** Respond in English at all times.
- **Runtime:** Node.js >= 20. NestJS 11.x. TypeScript strict mode. NEVER target older runtimes.
- **TypeScript:** `strict: true` enforced on ALL `.ts` files. No `any`. No `@ts-ignore`. No `as unknown as X`.
- **NestJS CLI:** Use `npx nest` — NEVER bare `nest` globally unless confirmed installed.
- **Single Source of Truth:** Follow `.claude/skills/BACKEND-NEST/SKILL.md` §0–§4 for ALL TypeScript/NestJS syntax decisions.
- **Architecture decision:** ALWAYS consult `.claude/skills/ARCHITECTURE-DECISION-GUIDE.md` first to pick the tier.
- **Architecture (simple):** Follow `.claude/skills/ARCHITECTURE-SIMPLE/SKILL.md` for lookup/config modules (≤5 fields, validate+save, no cache/audit/exports).
- **Architecture (default):** Follow `.claude/skills/ARCHITECTURE-DEFAULT/SKILL.md` for CRUDs with business logic, cache, audit, exports, bulk operations — the most common tier.
- **Architecture (upgrade):** Follow `.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md` ONLY for modules that meet upgrade triggers (domain events, cross-context ACL, state machines, invariants beyond "validate + save").
- **Security baseline:** Follow `.claude/skills/OWASP/SKILL.md` for all backend/API security decisions.
- **Claude Code 2026:** MCP servers are enabled by default in settings.json. Use MCP tools when available.
- **Investigate:** Run web search immediately before responding on any version-sensitive topic.

---

# [MUST] Before writing any code — read the relevant skill

| Task type                                       | Required reading                                         |
| ----------------------------------------------- | -------------------------------------------------------- |
| NestJS / TypeScript / Backend / Business logic  | `.claude/skills/BACKEND-NEST/SKILL.md`                   |
| New module (ANY architecture)                  | `.claude/skills/ARCHITECTURE-DECISION-GUIDE.md` — FIRST, then the selected architecture skill |
| New module (simple lookups/configs)             | `.claude/skills/ARCHITECTURE-SIMPLE/SKILL.md`         |
| New module (CRUDs with business logic)          | `.claude/skills/ARCHITECTURE-DEFAULT/SKILL.md`         |
| New module (complex bounded contexts)           | `.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md`       |
| Writing or reviewing a CRUD service/repository  | `.claude/skills/BACKEND-NEST-PATTERNS/SKILL.md`          |
| Security baseline / OWASP rules                 | `.claude/skills/OWASP/SKILL.md`                          |
| Audit agent / code review                       | `.claude/commands/BACKEND-AUDIT-NEST.md`                  |

> **Rule:** If a skill file covers the task, read it FIRST — no exceptions.
> **Architecture decision:** ALWAYS read `ARCHITECTURE-DECISION-GUIDE.md` first when creating a new module to determine which architecture to use.
> **Architecture default:** for most CRUDs use `ARCHITECTURE-DEFAULT`. Drop to `ARCHITECTURE-SIMPLE` only for lookups/configs (≤5 fields, no cache/audit/exports). Escalate to `ARCHITECTURE-ENTERPRISE` only with an explicit, justified upgrade trigger.
> **Total files:** 8 (this router + decision guide + 3 architecture skills + BACKEND-NEST + BACKEND-NEST-PATTERNS + OWASP). No redundancy.

---

# [MUST] TypeScript / NestJS

- Follow `.claude/skills/BACKEND-NEST/SKILL.md` strictly.
- No business logic in Controllers. In CRUD modules controllers call a Service; in Hex/DDD modules controllers call a Use Case. Never both styles in the same module.
- No direct repository calls from Controllers. Repository access goes through Service (CRUD) or Use Case / Event Listener (Hex/DDD).
- In Hex/DDD modules: every UseCase is an `@Injectable()` class with a single `execute()` method.
- No `any`. Zod v4 for ALL validation — never `class-validator`.
- Prisma v7 ORM only — never import Drizzle or TypeORM. Use the `prisma-client` generator with `output = "../src/generated/prisma"` and import `PrismaClient` from `./generated/prisma/client`, NEVER from `@prisma/client`.
- `nestjs-cls` for traceId/correlationId — never pass them as parameters.
- `IAuditPort` called manually in every write path that mutates state (write Use Case in Hex/DDD modules; mutation method in CRUD services when the module opts in to audit).
- Domain Events: only allowed in Hex/DDD modules; published via `EventEmitter2` after repository save — never before. CRUD modules do not emit domain events.
- `@nestjs/cqrs` is installed but NOT the default pattern — use Service (CRUD) or `application/use-cases/` (Hex/DDD). Importing `CommandBus`/`QueryBus`/`EventBus` requires an explicit, documented decision per bounded context.

---

# [MUST] Transactional writes

Every write path that mutates state across **more than one statement** (entity update + audit row, two repo writes, repo + token revocation, etc.) MUST be wrapped in a transaction so a partial failure rolls back cleanly.

- **Mechanism:** the project ships with `@nestjs-cls/transactional` + `TransactionalAdapterPrisma`, configured globally with `enableTransactionProxy: true` in `AppModule`. Inside a transactional boundary, every call that goes through `PrismaService` is automatically routed to the active tx — repositories do NOT need a `tx?` parameter.
- **Hex/DDD use cases / CQRS handlers:** apply `@Transactional()` from `@nestjs-cls/transactional` to the `execute()` method.
- **Flat CRUD services:** inject `TRANSACTION_MANAGER` (`ITransactionManager`) and wrap the multi-step mutation with `await this.tx.runInTx(async () => { ... })`. Do NOT use `@Transactional()` on CRUD service methods — keep the explicit `runInTx` block so the boundary is visible in the diff.
- **Audit inside the tx:** call `audit.log({...}, { strict: true })` so a failure to persist the audit row aborts the surrounding write. Without `strict: true` audit failures are swallowed and the mutation commits without trace.
- **Outside the tx:** cache invalidation (`cache.del`, `cache.delByPattern`), `EventEmitter2.emit`, email sends, R2 uploads. Side-effects must NEVER live inside the transactional block — Postgres cannot un-send an email.
- **R2 + DB compound writes:** upload the new blob FIRST → run the tx → on tx failure delete the freshly-uploaded blob in a best-effort try/catch. Delete the old blob ONLY after the tx commits. See `companydata.service.ts uploadSignature` and `blog-category.service.ts uploadImage` for the canonical pattern.
- **Read paths and login audit:** keep the default (`strict: false`) — read audit and login audit are fire-and-forget and must never abort the user flow.
- **Testing:** every spec for a method that uses `@Transactional()` must include `jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => (_t, _k, d) => d }))` at the top so the decorator becomes a no-op in unit tests. Specs for `runInTx`-based services pass a fake `tx` that just invokes the callback: `{ runInTx: async (fn) => fn() }`.
- **Spec assertions:** when asserting `audit.log` calls, include the second arg `, { strict: true }` — Jest matches all positional arguments.

> **Why the split (decorator vs `runInTx`)?** Hex/DDD use cases have a single `execute()` entrypoint, so the decorator is invisible noise-free. CRUD services expose many small methods; an explicit `runInTx` block keeps the transactional boundary readable in the diff and prevents accidentally wrapping non-write methods.

---

# [MUST] Architecture

- Every module lives in `src/modules/{name}/`. Three layouts are allowed; pick ONE per module and never mix them inside the same module.
- **SIMPLE — lookups/configs:** Service/Repository, 8–10 files, no cache/audit/exports/bulk. Full layout in `.claude/skills/ARCHITECTURE-SIMPLE/SKILL.md`.
- **DEFAULT — CRUDs with business logic:** Service/Repository with the Canonical Mutation Pattern (tx + audit + cache), bulk delete/restore, soft-delete visibility, exports. 10–12 files. Full layout and contracts live in `.claude/skills/ARCHITECTURE-DEFAULT/SKILL.md`.
- **UPGRADE — Hex/DDD + UseCase (CQRS optional):** allowed ONLY when an Upgrade Trigger is met. Upgrade triggers live in `.claude/skills/ARCHITECTURE-DECISION-GUIDE.md`. Full Hex/DDD layout, ports, mappers, and UseCase structure live in `.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md`. `CommandBus`/`QueryBus` are opt-in per bounded context.

## Migration rule

- Starting CRUD and upgrading later is the expected path. Do NOT pre-emptively scaffold `domain/application/infrastructure` for modules that have not yet hit an upgrade trigger.
- The repository and DTO layers migrate as-is — only the Service splits into Command/Query Handlers.

## Bulk operations (delete / restore)

- Any module with a list view that exposes multi-select must implement `POST /{module}/bulk-delete` and (when soft delete is enabled) `POST /{module}/bulk-restore` — never N single-id calls from the client.
- Method is **POST** (never `DELETE` with body). Response is `200 { count: number }` (never `204`).
- Repository uses **one** `updateMany` / `deleteMany` per call — never `Promise.all(ids.map(...))` over single-row methods.
- Audit: **one** row per bulk call (`{module}.bulk_deleted` / `{module}.bulk_restored`), with `ids[]` and `count` in `metadata`. No per-id audit rows.
- Cache: **one** `delByPattern` call (same pattern as the single-row mutation). Hex/DDD may additionally pipeline `del` for item keys.
- Domain events (Hex/DDD only): **one** `{Module}BulkDeletedEvent(ids)` per call — never one event per id.
- Zod DTO: `ids: z.array(z.string().uuid()).min(1).max(100)` — DoS bound (OWASP API #4).
- CASL: `Action.Restore` (distinct from `Action.Delete`) gates bulk-restore.
- Soft vs hard delete: pick **one** strategy per module/context and stick with it. Mixing is forbidden.
- Full spec: `.claude/skills/ARCHITECTURE-DEFAULT/SKILL.md` § "Bulk Delete / Bulk Restore (flat CRUD)" and `.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md` § "Bulk Delete / Bulk Restore (Hex/DDD)".

## Soft-delete visibility (`withTrashed` / `onlyTrashed`)

- Every list / single-get / export route of a soft-delete-aware module MUST accept `?withTrashed=true` and `?onlyTrashed=true`, defaulting to "active rows only". Sending both at the same time → 400.
- DTO MUST spread `trashedFlagsShape` and `.refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)` from `src/shared/crud/trashed.util.ts` — never re-roll the schema, never use `z.coerce.boolean()`.
- Repository takes `TrashedMode` (`'exclude' | 'include' | 'only'`) and calls `buildTrashedWhere(mode)` once; the single-get variant takes a `boolean withTrashed`.
- `?onlyTrashed=true` (or a dedicated `GET /{module}/trash` route) MUST be gated by `Action.Restore`, not `Action.Read` — prevents enumeration of tombstoned rows via the read permission.
- Response shape MUST expose `deletedAt: string | null` when the entity is soft-delete-aware; otherwise `withTrashed` is useless on the client.
- Full spec: `.claude/skills/ARCHITECTURE-DEFAULT/SKILL.md` § "Soft-delete visibility — withTrashed / onlyTrashed (flat CRUD)" and `.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md` § "Soft-delete visibility — withTrashed / onlyTrashed (Hex/DDD)".

## Identity responses — `roles[]` + `permissions[]`

- `GET /auth/me`, `GET /users`, `GET /users/:id`, `POST /users`, `PATCH /users/:id` MUST emit `roles[]` and effective (deduplicated) `permissions[]`. Empty arrays — never `null`, never absent.
- `permissions[]` is a **flat** list of `{ action, subject }`; the frontend must not walk `role.permissions[]`. Deduplication happens at the read-model / mapper, not in the controller.
- `MeRoleSchema` and `MePermissionSchema` (in `modules/auth/.../presenters/auth.response.ts`) are the single source of truth — import, never redefine per module.
- Token-issuing endpoints (`POST /auth/login`, `POST /auth/refresh`) MUST NOT include these arrays — clients call `/auth/me` after login.
- Never echo `passwordHash`, `totpSecret`, `backupCodes`, `mfaSecret`, or any refresh/session token in a user projection. `UserResponseSchema` is a strict allowlist.
- `GET /auth/me` MUST use `@SkipCache()` or per-user TTL ≤ 60s — permissions change mid-session. Every ACL mutation MUST `cache.delByPattern` both the `users` and `auth/me` cache keys.
- Full spec: `.claude/skills/ARCHITECTURE-DEFAULT/SKILL.md` § "Users & Auth response shape — roles + permissions" and `.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md` § "Users & Auth response shape — roles + permissions (Hex/DDD)".

---

# [MUST] Claude Code 2026 Integration

- MCP servers are pre-configured in `.claude/settings.json` for filesystem, postgres, github, and brave-search.
- Use MCP tools for database operations when available instead of direct SQL.
- Leverage GitHub MCP for repository operations and PR management.
- Use brave-search MCP for up-to-date documentation and version checks.
- File operations through MCP filesystem server for enhanced capabilities.
- All MCP operations are allowed by default in permissions configuration.

---

# [SHOULD] General quality

- Mobile-first on every HTTP response shape — keep payloads lean.
- Prefer descriptive names over comments.
- Every public method on a service/handler has an explicit return type.
- No `console.log` anywhere — always use injected `LoggerService`.
- Log entries without `traceId` or `correlationId` are forbidden in any handler or adapter.
