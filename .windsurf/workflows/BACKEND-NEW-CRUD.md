---
description: Scaffold a new NestJS simple CRUD module for small features using the Service/Repository pattern and the OWASP security baseline.
---

# BACKEND NEW CRUD — Simple NestJS Scaffold

## PHASE 1 — DISCOVER

1. Ask for the module name.
2. Ask for the entity fields and whether the feature is truly simple.
3. Ask whether the module needs only CRUD or also exports, events, or cross-context coordination.
4. Read the required guidance in this order:
   1. `.claude/skills/OWASP/SKILL.md`
   2. `.claude/skills/BACKEND-NEST/SKILL.md`
   3. `.claude/skills/ARCHITECTURE-NEST-CRUD/SKILL.md`


## PHASE 2 — SELECT THE LIGHTWEIGHT STRUCTURE

1. Use the simple CRUD structure when the feature has trivial or no business rules.
2. Keep the module inside `src/modules/{name}/`.
3. Create only these files unless the feature clearly needs more:
   - `{module}.module.ts`
   - `{module}.controller.ts`
   - `{module}.service.ts`
   - `{module}.repository.ts`
   - `{module}.entity.ts`
   - `{module}.prisma`  (mirror under `prisma/schema/{module}.prisma`)
   - `dto/create-{module}.dto.ts`
   - `dto/update-{module}.dto.ts`

## PHASE 3 — APPLY SECURITY FIRST

1. Validate all input with Zod.
2. Use authentication guards where the module is protected.
3. Protect all route params with the right validators.
4. Prevent injection and secret leakage.
5. Log safely and never use console statements.
6. Keep authorization simple and explicit.

## PHASE 4 — GENERATE THE MODULE

1. Create the Prisma model (`{module}.prisma`, also placed under `prisma/schema/`), entity, DTOs, repository, service, and controller.
2. Run `npx prisma generate` and `npx prisma migrate dev --name add-{module}` after writing the model.
3. Keep the service thin and orchestration-only.
4. Keep the repository as the only place that touches Prisma (`PrismaService` / generated `prisma/client`).
5. Add unit tests for service behavior.

## PHASE 5 — UPGRADE IF NEEDED

1. If the feature grows domain events, workflows, or cross-context coordination, switch to `/backend-new`.
2. WebSockets via `{module}.gateway.ts` + `shared/websockets` are allowed in CRUD — they do NOT force an upgrade.
3. If the feature needs RabbitMQ or domain events with real listeners, it no longer belongs in the simple CRUD workflow.
