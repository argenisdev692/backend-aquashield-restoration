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
   3. `.claude/skills/ARCHITECTURE-NEST/SKILL.md`

## PHASE 2 — SELECT ARCHITECTURE

1. If the module is simple CRUD (≤8 fields, no business rules), stop and redirect to `/backend-new-crud`.
2. If the module has workflows, domain rules, audit requirements, events, or ACL, use the enterprise structure.
3. Create the module under `src/modules/{name}/` with:
   - `domain/` — aggregates, value objects, domain events (plain TS), repository interfaces, ports
   - `application/use-cases/` — one UseCase class per operation (write and read)
   - `infrastructure/` — controllers, repositories, event listeners, gateways, adapters

## PHASE 3 — APPLY SECURITY FIRST

1. Enforce Zod validation for all inputs.
2. Apply `@UseGuards(JwtAuthGuard, CaslGuard)` on all controller routes.
3. Ensure every state mutation is auditable — `IAuditPort.log()` in every Write UseCase.
4. Add structured logging with `traceId` in every UseCase via `ClsService`.
5. Protect external integrations with timeouts, allowlists, and safe error handling.

## PHASE 4 — GENERATE THE MODULE

1. Create domain model: aggregate, value objects, domain exceptions, domain events, repository interface, port interfaces.
2. Create use cases: one `@Injectable()` class per operation with a single `execute()` method.
3. Add infrastructure layer: controller (injects UseCases directly, no bus), Prisma repository (`prisma-{module}.repository.ts` injecting `PrismaService`), mapper, event listeners.
4. Register all providers and Symbol bindings in the module — include `EventEmitterModule` if using domain events.
5. Add tests: domain unit tests (zero NestJS), use case unit tests (mock ports), integration tests (real DB via testcontainers).

## PHASE 5 — VERIFY

1. Confirm `@nestjs/cqrs` is NOT imported anywhere in the module.
2. Confirm all Write UseCases call `IAuditPort.log()` with the correct `{module}.{verb}` action.
3. Confirm all GET controller methods have `@CacheTTL(TTL_SECONDS.X)`.
4. Confirm the module follows the architecture guide (domain → application → infrastructure boundaries).
5. Confirm the OWASP baseline is reflected in the feature design.
6. Confirm no security-sensitive shortcuts were introduced.
