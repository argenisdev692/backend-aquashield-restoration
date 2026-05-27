---
description: Scaffold a new NestJS backend or complex bounded context with Hexagonal + DDD architecture (UseCase pattern), BullMQ job queue support, and the OWASP security baseline.
---

# BACKEND NEW — Enterprise NestJS Scaffold

## PHASE 1 — DISCOVER

1. Ask for the module or bounded context name.
2. Ask whether the feature needs REST only or REST + WebSocket.
3. Ask whether the module has real business rules, audit needs, domain events, or cross-context coordination.
4. Read the required guidance in this order:
   1. `.claude/skills/OWASP/SKILL.md`
   2. `.claude/skills/BACKEND-NEST/SKILL.md`
   3. `.claude/skills/BACKEND-NEST-PATTERNS/SKILL.md` — findOrFail, singleton guard, repository return rules (applies to SIMPLE + DEFAULT)
   4. `.claude/skills/ARCHITECTURE-DECISION-GUIDE.md` — to decide which architecture to use
   5. Then read the selected architecture skill:
      - `.claude/skills/ARCHITECTURE-SIMPLE/SKILL.md` for simple lookups/configs
      - `.claude/skills/ARCHITECTURE-DEFAULT/SKILL.md` for CRUDs with business logic
      - `.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md` for complex bounded contexts

## PHASE 2 — SELECT ARCHITECTURE

1. Use the ARCHITECTURE-DECISION-GUIDE to determine which architecture to use based on:
   - Business rules complexity
   - Need for domain events
   - Cross-context coordination requirements
   - State machines or invariants
2. The decision guide will direct you to:
   - ARCHITECTURE-SIMPLE for lookups/configs (≤5 fields, no business rules)
   - ARCHITECTURE-DEFAULT for CRUDs with business logic (exports, cache, audit)
   - ARCHITECTURE-ENTERPRISE for complex bounded contexts (domain events, ACL, state machines)
3. Create the module under `src/modules/{name}/` with the appropriate structure:
   - **If SIMPLE**: flat structure — `{module}.module/controller/service/repository/entity.ts` + `dto/`
   - **If DEFAULT**: flat structure with exports/cache/audit — `{module}.module/controller/service/repository/entity.ts` + `dto/` + optional export endpoints
   - **If ENTERPRISE**: Hex/DDD structure — `domain/` (aggregates, value objects, domain events, repository interfaces, ports), `application/use-cases/` (one UseCase class per operation), `infrastructure/` (controllers, repositories, event listeners, gateways, adapters)

## PHASE 3 — APPLY SECURITY FIRST

1. Enforce Zod validation for all inputs.
2. Apply `@UseGuards(JwtAuthGuard, CaslGuard)` on all controller routes.
3. Ensure every state mutation is auditable — `IAuditPort.log()` in every Write UseCase.
4. Add structured logging with `traceId` in every UseCase via `ClsService`.
5. Protect external integrations with timeouts, allowlists, and safe error handling.

## PHASE 4 — GENERATE THE MODULE

**If ARCHITECTURE-SIMPLE:**
1. Create `{module}.entity.ts` — plain TypeScript interface
2. Create DTOs in `dto/`: `create-{module}.dto.ts` (Zod schema) and `update-{module}.dto.ts` (partial)
3. Create `{module}.repository.ts` — Prisma queries, returns entity types
4. Create `{module}.service.ts` — orchestration, injects repository, optional IAuditPort/CacheService
5. Create `{module}.controller.ts` — HTTP endpoints, injects service, guards, Swagger
6. Create `{module}.module.ts` — register controller, service, repository
7. Add unit test: `{module}.service.spec.ts` (repository mocked)

**If ARCHITECTURE-DEFAULT:**
1. Follow SIMPLE structure above
2. Add export endpoints in controller (Excel/PDF) with `@SkipCache()`
3. Add cache invalidation in service mutations (`cache.delByPattern()`)
4. Add audit logging in service mutations (`IAuditPort.log()`)
5. Apply Canonical Mutation Pattern (transaction + audit + cache)

**If ARCHITECTURE-ENTERPRISE:**
1. Create domain model: aggregate, value objects, domain exceptions, domain events, repository interface, port interfaces.
2. Create use cases: one `@Injectable()` class per operation with a single `execute()` method.
3. Add infrastructure layer: controller (injects UseCases directly, no bus), Prisma repository (`prisma-{module}.repository.ts` injecting `PrismaService`), mapper, event listeners.
4. Register all providers and Symbol bindings in the module — include `EventEmitterModule` if using domain events.
5. Add tests: domain unit tests (zero NestJS), use case unit tests (mock ports), integration tests (real DB via testcontainers).

## PHASE 5 — VERIFY

**If ARCHITECTURE-SIMPLE or DEFAULT:**
1. Confirm no `domain/`, `application/`, `infrastructure/` folders exist.
2. Confirm controller injects Service directly (not repository, not bus).
3. Confirm repository is the ONLY file importing PrismaService.
4. Confirm all GET controller methods have `@CacheTTL(TTL_SECONDS.X)` (if opted into cache).
5. Confirm the module follows the selected architecture guide.
6. Confirm the OWASP baseline is reflected in the feature design.

**If ARCHITECTURE-ENTERPRISE:**
1. Confirm `@nestjs/cqrs` is NOT imported anywhere in the module — UNLESS the module README / module file contains an explicit opt-in justification (saga orchestration, multiple handlers per command, decoupled write/read models). Default Hex/DDD shape is one `@Injectable()` UseCase per operation, controllers inject UseCases directly.
2. Confirm all Write UseCases call `IAuditPort.log()` with the correct `{module}.{verb}` action.
3. Confirm all GET controller methods have `@CacheTTL(TTL_SECONDS.X)`.
4. Confirm the module follows the architecture guide (domain → application → infrastructure boundaries).
5. Confirm the OWASP baseline is reflected in the feature design.
6. Confirm no security-sensitive shortcuts were introduced.
