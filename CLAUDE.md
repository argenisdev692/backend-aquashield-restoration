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

- `.claude/rules/backend-nest.md` — TypeScript/NestJS decision router (STRICT). Single source of truth for all stack/syntax rules.

**Auto-invocable skills** (Claude loads them based on context):

- `.claude/skills/BACKEND-NEST/SKILL.md` — NestJS 11 · TypeScript 5.x enterprise stack (CQRS handlers, Prisma, Zod, Swagger, logging, cache, exports, CASL)
- `.claude/skills/ARCHITECTURE-NEST/SKILL.md` — Hexagonal / DDD layout for complex bounded contexts
- `.claude/skills/ARCHITECTURE-NEST-CRUD/SKILL.md` — Flat Service/Repository layout for simple CRUD (DEFAULT; contains the canonical Upgrade Triggers table)
- `.claude/skills/BACKEND-NEST-PATTERNS/SKILL.md` — DRY service patterns (findOrFail, singleton guard, repository return types, storage side-effects)
- `.claude/skills/OWASP/SKILL.md` — OWASP Security Baseline (2025/2023)

## Critical rules (pointers — content lives in linked files)

<critical>
- **Stack & syntax SoT:** `.claude/rules/backend-nest.md` is the [ABSOLUTE]/[MUST] router — covers TS strict, no `any`/`@ts-ignore`, `npx nest`, Prisma v7 (`prisma-client` generator + import from `src/generated/prisma/client`), Zod v4, nestjs-cls, controllers no business logic, CQRS-not-default, IAuditPort manual, logging with traceId, bulk operations.
- **Architecture decision:** start at `.claude/skills/ARCHITECTURE-NEST-CRUD/SKILL.md`. Escalate to `.claude/skills/ARCHITECTURE-NEST/SKILL.md` ONLY when an Upgrade Trigger (listed in the CRUD skill) is met.
- **Security baseline:** `.claude/skills/OWASP/SKILL.md` applies to every endpoint, adapter, and external integration.
- **DRY service patterns:** `.claude/skills/BACKEND-NEST-PATTERNS/SKILL.md` — apply before writing any CRUD service method.
- **Git safety (CLAUDE-only, not in router):** NEVER commit `.env`, credentials, or keys. NEVER `git push --force` to `main`/`master`. NEVER `--no-verify` unless explicitly requested.
- **Tests (CLAUDE-only, not in router):** Integration tests MUST NOT mock the database.
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
│   ├── ARCHITECTURE-NEST/SKILL.md      # Hexagonal / DDD
│   ├── ARCHITECTURE-NEST-CRUD/SKILL.md # CRUD Service/Repository
│   ├── BACKEND-NEST-PATTERNS/SKILL.md  # DRY helpers: findOrFail, singleton guard, storage side-effects
│   └── OWASP/SKILL.md                  # security baseline
├── agents/                             # specialized sub-agents (empty for now)
└── commands/                           # manual slash commands
    ├── BACKEND-NEW.md
    ├── BACKEND-NEW-CRUD.md
    └── BACKEND-AUDIT-NEST.md
```
