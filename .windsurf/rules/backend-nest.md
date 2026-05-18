---
trigger: always_on
---

# [ABSOLUTE] Non-negotiable constraints — ALWAYS apply

- **Language:** Respond in English at all times.
- **Runtime:** Node.js >= 20. NestJS 11.x. TypeScript strict mode. NEVER target older runtimes.
- **TypeScript:** `strict: true` enforced on ALL `.ts` files. No `any`. No `@ts-ignore`. No `as unknown as X`.
- **NestJS CLI:** Use `npx nest` — NEVER bare `nest` globally unless confirmed installed.
- **Single Source of Truth:** Follow `.windsurf/skills/BACKEND-NEST/SKILL.md` §0–§4 for ALL TypeScript/NestJS syntax decisions.
- **Architecture (default):** Follow `.windsurf/skills/ARCHITECTURE-NEST-CRUD/SKILL.md` for ALL new modules unless an explicit upgrade trigger is met.
- **Architecture (upgrade):** Follow `.windsurf/skills/ARCHITECTURE-NEST/SKILL.md` ONLY for modules that meet upgrade triggers (domain events, cross-context ACL, state machines, invariants beyond "validate + save").
- **Security baseline:** Follow `.windsurf/skills/OWASP/SKILL.md` for all backend/API security decisions.
- **Claude Code 2026:** MCP servers are enabled by default in settings.json. Use MCP tools when available.
- **Investigate:** Run web search immediately before responding on any version-sensitive topic.

---

# [MUST] Before writing any code — read the relevant skill

| Task type                                       | Required reading                                         |
| ----------------------------------------------- | -------------------------------------------------------- |
| NestJS / TypeScript / Backend / Business logic  | `.windsurf/skills/BACKEND-NEST/SKILL.md`                   |
| New module (default — CRUD / lookups / configs) | `.windsurf/skills/ARCHITECTURE-NEST-CRUD/SKILL.md`         |
| New module (only if upgrade trigger is met)     | `.windsurf/skills/ARCHITECTURE-NEST/SKILL.md`              |
| Writing or reviewing a CRUD service/repository  | `.windsurf/skills/BACKEND-NEST-PATTERNS/SKILL.md`          |
| Security baseline / OWASP rules                 | `.windsurf/skills/OWASP/SKILL.md`                          |
| Audit agent / code review                       | `.windsurf/commands/BACKEND-AUDIT-NEST.md`                 |

> **Rule:** If a skill file covers the task, read it FIRST — no exceptions.
> **Architecture default:** when in doubt, use `ARCHITECTURE-NEST-CRUD`. Escalate to `ARCHITECTURE-NEST` only with an explicit, justified upgrade trigger.
> **Total files:** 7 (this router + 5 skills + security baseline). No redundancy.

---

# [MUST] TypeScript / NestJS

- Follow `.windsurf/skills/BACKEND-NEST/SKILL.md` strictly.
- No business logic in Controllers. ALL modules dispatch via `CommandBus`/`QueryBus`. Controller never injects handlers or services directly.
- No direct repository calls from Controllers. Repository access goes through Command/Query Handlers only.
- Every write operation is a `@CommandHandler` class with `execute(command)`. Every read operation is a `@QueryHandler` class with `execute(query)`.
- No `any`. Zod v4 for ALL validation — never `class-validator`.
- Prisma v7 ORM only — never import Drizzle or TypeORM. Use the `prisma-client` generator with `output = "../src/generated/prisma"` and import `PrismaClient` from `./generated/prisma/client`, NEVER from `@prisma/client`.
- `nestjs-cls` for traceId/correlationId — never pass them as parameters.
- `IAuditPort` called manually in every write path that mutates state (CommandHandler — optional in simple CQRS modules, mandatory in Hex/DDD modules).
- Domain Events: only allowed in Hex/DDD modules; published via `EventEmitter2` after repository save — never before. Simple CQRS modules do not emit domain events.
- `@nestjs/cqrs` v11 — **adopted for ALL modules**. Controllers dispatch via `CommandBus`/`QueryBus`. Domain Events still use `EventEmitter2` (NOT `@nestjs/cqrs` `EventBus`).

---

# [MUST] Architecture

- Every module lives in `src/modules/{name}/`. Two layouts are allowed; pick ONE per module and never mix them inside the same module.

## Simple CQRS layout (DEFAULT)

- Follow `.windsurf/skills/ARCHITECTURE-NEST-CRUD/SKILL.md` strictly.
- Use for: modules with no complex domain logic, no cross-context coordination.
- Folder-per-feature: each command/query folder colocates `.command.ts` + `.handler.ts` (or `.query.ts` + `.handler.ts`).
- Structure:
  - `application/commands/{verb}-{module}/` — colocated .command.ts + .handler.ts
  - `application/queries/get-{module}-xxx/` — colocated .query.ts + .handler.ts
  - `application/dtos/` — Zod schemas
  - `application/read-models/` — response shapes
  - `domain/entities/` — plain TS interfaces/classes
  - `domain/value-objects/` — simple VOs if needed
  - `domain/events/` — placeholder (empty until upgrade)
  - `domain/exceptions/` — domain-specific exceptions
  - `domain/ports/` — I{Module}Repository interface
  - `infrastructure/persistence/mappers/` + `repositories/` — Prisma impl
  - `infrastructure/api/controllers/` + `presenters/` — HTTP layer
  - `infrastructure/event-listeners/` — placeholder (empty until upgrade)
  - `infrastructure/gateways/` — optional WebSocket gateway
- Controller dispatches via `CommandBus`/`QueryBus`. Never injects handlers.
- Repository in `infrastructure/persistence/repositories/` is the ONLY file that imports `PrismaService`.
- Shared infra (`shared/export`, `shared/websockets`, `shared/activity-log`, `shared/external/*`, `shared/messaging`) is allowed and does NOT force an upgrade.

## Hex/DDD layout (UPGRADE ONLY)

- Follow `.windsurf/skills/ARCHITECTURE-NEST/SKILL.md` strictly.
- Use ONLY when at least one upgrade trigger is met: domain events with real listeners, cross-context coordination via ACL, state machines / multi-step workflows, invariants that must live in one place (Value Objects, aggregate factories), or any service method exceeding ~20 lines of business logic.
- Layout: `domain/`, `application/`, `infrastructure/`.
- `domain/` imports NOTHING from NestJS, Prisma, or any infrastructure package.
- `application/commands/` and `application/queries/` import ONLY from `domain/` and port interfaces — never from `infrastructure/`.
- `infrastructure/` is the ONLY layer allowed to import NestJS decorators, Prisma, or external services.
- Mapper is the ONLY contact point between domain entities and Prisma rows (the row type comes from `src/generated/prisma`).
- Port interfaces use `I` prefix: `IUserRepository`, `IAuditPort`, `IEmailPort`.
- Symbol tokens for DI: `USER_REPOSITORY`, `AUDIT_PORT`, `EMAIL_PORT`.
- Domain events are plain TypeScript classes in `domain/events/` — no framework dependency.
- Event listeners live in `infrastructure/event-listeners/` — decorated with `@OnEvent()`.

## Migration rule

- Starting with simple CQRS and upgrading to full Hex/DDD later is the expected path. The folder structure is the SAME — the upgrade adds domain richness (populated VOs, events with real listeners, ACL adapters) into the existing folders.
- The repository, DTO, and command/query layers migrate as-is — no rewrite needed.

---

# [MUST] Claude Code 2026 Integration

- MCP servers are pre-configured in `.windsurf/settings.json` for filesystem, postgres, github, and brave-search.
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
