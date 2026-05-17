@AGENTS.md

# Backend Project NestJS 11.x

> Short file (<200 lines). Detailed rules are loaded on demand from `.claude/rules/`.

## Stack

- **Runtime:** Node.js >= 20
- **Framework:** NestJS 11.x
- **Language:** TypeScript strict mode
- **ORM:** Prisma v7 (never Drizzle or TypeORM) — `prisma-client` generator + `@prisma/adapter-pg` driver adapter
- **Validation:** Zod v4 (never class-validator)
- **Architecture:** two allowed layouts — flat CRUD (Service/Repository) by default; Hex/DDD + UseCase pattern only when an upgrade trigger is met
- **Events:** @nestjs/event-emitter for domain events (EventEmitter2) — Hex/DDD modules only
- **Context:** nestjs-cls for traceId/correlationId
- **DB:** PostgreSQL (Supabase)
- **Tests:** Jest
- **Infra:** Docker, CI on GitHub Actions

## Key commands

- Dev: `npm run start:dev`
- Build: `npm run build`
- Tests: `npm test`
- E2E: `npm run test:e2e`
- Lint: `npm run lint`
- Prisma generate: `npx prisma generate`
- Prisma migrate (dev): `npx prisma migrate dev`
- Prisma db push (no migration): `npx prisma db push`
- Seed: `npx prisma db seed`
- Initial bootstrap SQL (extension, uuid_generate_v7, triggers, partial indexes): `npx prisma db execute --file prisma/bootstrap.sql`

## On-demand rules

**Static rule (manual):**

- `.claude/rules/backend-nest.md` — TypeScript/NestJS decision router (STRICT)

**Auto-invocable skills** (Claude loads them based on context):

- `.claude/skills/BACKEND-NEST/SKILL.md` — NestJS 11 · TypeScript 5.x enterprise backend
- `.claude/skills/ARQUITECTURE-NEST/SKILL.md` — Hexagonal / DDD for complex bounded contexts
- `.claude/skills/ARQUITECTURE-NEST-CRUD/SKILL.md` — Service/Repository pattern for simple CRUD
- `.claude/skills/BACKEND-NEST-PATTERNS/SKILL.md` — DRY service patterns (findOrFail, singleton guard, repository return types, storage side-effects)
- `.claude/skills/OWASP/SKILL.md` — OWASP Security Baseline (2025/2023)

## Critical rules (always active)

<critical>
- **TypeScript strict mode:** `strict: true` in every `.ts` file. NEVER `any`, NEVER `@ts-ignore`, NEVER `as unknown as X`.
- **NestJS CLI:** Use `npx nest` — NEVER the global `nest`.
- **Single Source of Truth:** Follow `.claude/rules/backend-nest.md` for every TypeScript/NestJS syntax decision.
- **Architecture (default):** Follow `.claude/skills/ARQUITECTURE-NEST-CRUD/SKILL.md` for every new module unless an upgrade trigger is justified.
- **Architecture (upgrade):** Follow `.claude/skills/ARQUITECTURE-NEST/SKILL.md` ONLY when the module needs domain events with real listeners, cross-context ACL, state machines / multi-step workflows, invariants in VOs/aggregates, or service methods exceeding ~20 lines of logic.
- **Security:** Follow `.claude/skills/OWASP/SKILL.md` for every backend/API security decision.
- **ORM:** Prisma v7 ONLY — NEVER import Drizzle or TypeORM. `prisma-client` generator with `output = "../src/generated/prisma"`. Always import from `src/generated/prisma/client`, NEVER from `@prisma/client`.
- **Validation:** Zod v4 for ALL validation — NEVER `class-validator`.
- **Context:** nestjs-cls for traceId/correlationId — NEVER pass them as parameters.
- **Controllers:** Never contain business logic. CRUD modules call a Service; Hex/DDD modules call a UseCase. Never mix both styles in the same module.
- **CQRS:** `@nestjs/cqrs` is installed but is NOT the default pattern. Service (CRUD) or UseCase (Hex/DDD) are the SoT. Use `CommandBus`/`QueryBus`/`EventBus` only with an explicit, documented decision per bounded context.
- **IAuditPort:** Called manually in every write path that mutates state (write UseCase in Hex/DDD; Service mutation method in CRUD when the module opts in to audit).
- **Logging:** NEVER `console.log` — always use the injected LoggerService. Log entries without traceId/correlationId are forbidden.
- **Git:** NEVER commit `.env`, credentials, or keys. NEVER `git push --force` to `main`/`master`.
- **Tests:** Integration tests MUST NOT mock the database.
</critical>

## Workflow

1. For complex tasks: enable Plan Mode (`Shift+Tab` twice).
2. Use `/clear` between unrelated tasks to save context.
3. Run `/compact` when reaching 50% context.
4. Auto-invocable skills live in `.claude/skills/` (Claude invokes them automatically based on context).
5. Manual workflows are exposed as slash-commands in `.claude/commands/`.

## Available slash commands

- `/backend-new` — Scaffold a new NestJS backend with enterprise architecture, BullMQ job queue, OWASP security baseline
- `/backend-new-crud` — Scaffold a simple NestJS CRUD module with Service/Repository pattern and OWASP security baseline
- `/backend-audit-nest` — Audit a NestJS/TypeScript module against architecture, security, audit & test rules

## Repo structure

```
.claude/
├── settings.json                       # permissions, env, MCP, hooks
├── rules/                              # manual rules (loaded on demand)
│   └── backend-nest.md                 # TypeScript/NestJS router
├── skills/                             # auto-invocable SKILL.md files
│   ├── BACKEND-NEST/SKILL.md           # NestJS 11 enterprise stack
│   ├── ARQUITECTURE-NEST/SKILL.md      # Hexagonal / DDD
│   ├── ARQUITECTURE-NEST-CRUD/SKILL.md # CRUD Service/Repository
│   ├── BACKEND-NEST-PATTERNS/SKILL.md  # DRY helpers: findOrFail, singleton guard, storage side-effects
│   └── OWASP/SKILL.md                  # security baseline
├── agents/                             # specialized sub-agents (empty for now)
└── commands/                           # manual slash commands
    ├── BACKEND-NEW.md
    ├── BACKEND-NEW-CRUD.md
    └── BACKEND-AUDIT-NEST.md
```
