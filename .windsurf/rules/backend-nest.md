---
trigger: always_on
---

# [ABSOLUTE] Non-negotiable constraints — ALWAYS apply

- **Language:** Respond in English at all times.
- **Runtime:** Node.js >= 20. NestJS 11.x. TypeScript strict mode. NEVER target older runtimes.
- **TypeScript:** `strict: true` enforced on ALL `.ts` files. No `any`. No `@ts-ignore`. No `as unknown as X`.
- **NestJS CLI:** Use `npx nest` — NEVER bare `nest` globally unless confirmed installed.
- **Single Source of Truth:** Follow `.claude/skills/BACKEND-NEST/SKILL.md` §0–§4 for ALL TypeScript/NestJS syntax decisions.
- **Architecture (default):** Follow `.claude/skills/ARQUITECTURE-NEST-CRUD/SKILL.md` for ALL new modules unless an explicit upgrade trigger is met.
- **Architecture (upgrade):** Follow `.claude/skills/ARQUITECTURE-NEST/SKILL.md` ONLY for modules that meet upgrade triggers (domain events, cross-context ACL, state machines, invariants beyond "validate + save").
- **Security baseline:** Follow `.claude/skills/OWASP/SKILL.md` for all backend/API security decisions.
- **Claude Code 2026:** MCP servers are enabled by default in settings.json. Use MCP tools when available.
- **Investigate:** Run web search immediately before responding on any version-sensitive topic.

---

# [MUST] Before writing any code — read the relevant skill

| Task type                                       | Required reading                                         |
| ----------------------------------------------- | -------------------------------------------------------- |
| NestJS / TypeScript / Backend / Business logic  | `.claude/skills/BACKEND-NEST/SKILL.md`                   |
| New module (default — CRUD / lookups / configs) | `.claude/skills/ARQUITECTURE-NEST-CRUD/SKILL.md`         |
| New module (only if upgrade trigger is met)     | `.claude/skills/ARQUITECTURE-NEST/SKILL.md`              |
| Writing or reviewing a CRUD service/repository  | `.claude/skills/BACKEND-NEST-PATTERNS/SKILL.md`          |
| Security baseline / OWASP rules                 | `.claude/skills/OWASP/SKILL.md`                          |
| Audit agent / code review                       | `.claude/commands/BACKEND-AUDIT-NEST.md`                 |

> **Rule:** If a skill file covers the task, read it FIRST — no exceptions.
> **Architecture default:** when in doubt, use `ARQUITECTURE-NEST-CRUD`. Escalate to `ARQUITECTURE-NEST` only with an explicit, justified upgrade trigger.
> **Total files:** 7 (this router + 5 skills + security baseline). No redundancy.

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

# [MUST] Architecture

- Every module lives in `src/modules/{name}/`. Two layouts are allowed; pick ONE per module and never mix them inside the same module.

## CRUD layout (DEFAULT)

- Follow `.claude/skills/ARQUITECTURE-NEST-CRUD/SKILL.md` strictly.
- Use for: lookups, configs, tags/categories/statuses, any module with ≤8 fields and no business rules beyond "validate + save".
- Files: `{module}.module.ts`, `{module}.controller.ts`, `{module}.service.ts`, `{module}.repository.ts`, `{module}.entity.ts`, `dto/`, optional `{module}.gateway.ts`. No `domain/`, no `application/`, no `infrastructure/` folders.
- Repository is the ONLY file that imports `PrismaService` / generated Prisma types. Service throws `NotFoundException` on `null`. Controller only handles HTTP concerns.
- Shared infra (`shared/export`, `shared/websockets`, `shared/activity-log`, `shared/external/*`, `shared/messaging`) is allowed and does NOT force an upgrade.

## Hex/DDD layout (UPGRADE ONLY)

- Follow `.claude/skills/ARQUITECTURE-NEST/SKILL.md` strictly.
- Use ONLY when at least one upgrade trigger is met: domain events with real listeners, cross-context coordination via ACL, state machines / multi-step workflows, invariants that must live in one place (Value Objects, aggregate factories), or any service method exceeding ~20 lines of business logic.
- Layout: `domain/`, `application/`, `infrastructure/`.
- `domain/` imports NOTHING from NestJS, Prisma, or any infrastructure package.
- `application/use-cases/` imports ONLY from `domain/` and port interfaces — never from `infrastructure/`.
- `infrastructure/` is the ONLY layer allowed to import NestJS decorators, Prisma, or external services.
- Mapper is the ONLY contact point between domain entities and Prisma rows (the row type comes from `src/generated/prisma`).
- Port interfaces use `I` prefix: `IUserRepository`, `IAuditPort`, `IEmailPort`.
- Symbol tokens for DI: `USER_REPOSITORY`, `AUDIT_PORT`, `EMAIL_PORT`.
- Domain events are plain TypeScript classes in `domain/events/` — no framework dependency.
- Event listeners live in `infrastructure/event-listeners/` — decorated with `@OnEvent()`.

## Migration rule

- Starting CRUD and upgrading later is the expected path. Do NOT pre-emptively scaffold `domain/application/infrastructure` for modules that have not yet hit an upgrade trigger.
- The repository and DTO layers migrate as-is — no rewrite needed.

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
