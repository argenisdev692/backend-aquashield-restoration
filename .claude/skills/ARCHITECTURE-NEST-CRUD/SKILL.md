---
description: Directory structure of each NestJS service — Simple CQRS (folder-per-feature). Recommended default for solo developers and small/medium features. Uses CommandBus/QueryBus with colocated command+handler per operation. For complex bounded contexts with domain events, ACL, or workflows → see `.claude/skills/ARCHITECTURE-NEST/SKILL.md`.
globs: src/modules/**
---

# ARCHITECTURE-NEST-CRUD — Simple CQRS Structure (2026)

> **Authority**: SINGLE SOURCE OF TRUTH for simple module file placement.
> **Pattern**: CQRS with folder-per-feature colocation. CommandBus/QueryBus dispatch. No domain events, no aggregate pattern.
> **When to use this**: modules with no complex domain logic, no domain events, no sagas, no cross-context orchestration.
> **Default for this repo**: start here unless the module has real business rules, workflows, or cross-context coordination.
> **When to upgrade to `.claude/skills/ARCHITECTURE-NEST/SKILL.md`**: module grows domain events, needs ACL adapters, state machines, or cross-context coordination.

---

## 🧭 Quick Decision Guide

| Signal | Use this file | Use `ARCHITECTURE-NEST/SKILL.md` |
|---|---|---|
| Business rules | None / trivial validations | State machines, invariants, multi-step workflows |
| Events | No | Yes (domain events with real listeners) |
| Cross-context | No | Yes (ACL adapters) |
| Value Objects | No | Yes |
| Export (xlsx/pdf) | Optional (via shared/) | Yes (dedicated export command) |
| Example | `users`, `categories`, `tags`, `statuses`, `contacts` | `projects`, `estimates`, `contractors` |

---

## 📁 Simple CQRS Module Structure (folder-per-feature)

```
modules/{module}/
├── {module}.module.ts              # CqrsModule import + Handlers + repository binding
│
├── __tests__/
│   ├── commands/
│   │   ├── create-{module}.handler.spec.ts
│   │   ├── update-{module}.handler.spec.ts
│   │   └── delete-{module}.handler.spec.ts
│   └── queries/
│       ├── get-{module}-by-id.handler.spec.ts
│       └── get-{module}-list.handler.spec.ts
│
├── application/
│   ├── commands/
│   │   ├── create-{module}/
│   │   │   ├── create-{module}.command.ts
│   │   │   └── create-{module}.handler.ts
│   │   ├── update-{module}/
│   │   │   ├── update-{module}.command.ts
│   │   │   └── update-{module}.handler.ts
│   │   └── delete-{module}/
│   │       ├── delete-{module}.command.ts
│   │       └── delete-{module}.handler.ts
│   ├── queries/
│   │   ├── get-{module}-by-id/
│   │   │   ├── get-{module}-by-id.query.ts
│   │   │   └── get-{module}-by-id.handler.ts
│   │   └── get-{module}-list/
│   │       ├── get-{module}-list.query.ts
│   │       └── get-{module}-list.handler.ts
│   ├── dtos/
│   │   ├── create-{module}.dto.ts             # Zod schema + z.infer<>
│   │   └── update-{module}.dto.ts             # CreateSchema.partial()
│   └── read-models/
│       └── {module}.read-model.ts
│
├── domain/
│   ├── entities/
│   │   └── {module}.entity.ts
│   ├── value-objects/
│   ├── events/
│   ├── exceptions/
│   └── ports/
│       └── {module}.repository.interface.ts   # I{Module}Repository
│
└── infrastructure/
    ├── persistence/
    │   ├── mappers/
    │   │   └── {module}.mapper.ts
    │   └── repositories/
    │       └── prisma-{module}.repository.ts  # Implements I{Module}Repository
    ├── api/
    │   ├── controllers/
    │   │   └── {module}.controller.ts         # REST: dispatches via CommandBus / QueryBus
    │   └── presenters/
    │       └── {module}.response.ts
    ├── event-listeners/
    └── gateways/
```

> **Same folder structure as full Hex/DDD (`ARCHITECTURE-NEST/SKILL.md`)** — the upgrade path simply populates the placeholder folders (events, event-listeners, value-objects) with real implementations. No structural refactoring needed.

---

## 📄 File Responsibilities

### `domain/entities/{module}.entity.ts`
Plain TypeScript interface — shape of the domain object. No NestJS, no Prisma, no decorators. Always includes `id`, `createdAt`, `updatedAt`. Nullable fields typed as `T | null`, never `T | undefined`.

### `application/dtos/create-{module}.dto.ts`
Zod v4 schema exported as `Create{Module}Schema` + inferred type `Create{Module}Dto`. Import from `zod` (the main entry of `zod@^4` already exports v4). Always export both the schema and the type — the schema goes to the pipe, the type goes to the command constructor.

### `application/dtos/update-{module}.dto.ts`
Always derived from `Create{Module}Schema.partial()`. Never redefine fields. Export `Update{Module}Schema` + `Update{Module}Dto`.

### `domain/ports/{module}.repository.interface.ts`
Defines `I{Module}Repository` — the contract that `infrastructure/persistence/repositories/` implements. Methods: `findById`, `findAll`, `create`, `update`, `delete`. Never imports Prisma types.

### `domain/exceptions/{module}-domain.exception.ts`
Domain-specific exceptions. Thrown in handlers when domain rules are violated.

---

### `infrastructure/persistence/repositories/prisma-{module}.repository.ts`
The only file that imports `PrismaService`. Implements `I{Module}Repository`. Returns entity types — never raw Prisma row types. `findById` returns `Entity | null`. `update` returns `Entity` (Prisma throws P2025 if not found). `delete` returns `void`. UUID v7 handled by DB default. Never throws `HttpException`.

### `infrastructure/persistence/mappers/{module}.mapper.ts`
Converts between Prisma row types and domain entities. Single source of truth for serialization/deserialization.

---

### `application/commands/{verb}-{module}/{verb}-{module}.handler.ts`
Write logic. Injects repository via Symbol token. Throws `NotFoundException` if entity not found. Decorated with `@CommandHandler(XxxCommand)`. If a handler exceeds ~20 lines of business logic, it's a signal to upgrade to full Hex/DDD.

### `application/queries/get-{module}-xxx/get-{module}-xxx.handler.ts`
Read logic. Injects repository. Decorated with `@QueryHandler(XxxQuery)`. Returns typed entity or list.

---

### `infrastructure/api/controllers/{module}.controller.ts`
HTTP layer only. Injects `CommandBus` + `QueryBus`. Applies `@UseGuards(JwtAuthGuard, CaslGuard)` at class level. Applies `ZodValidationPipe` per mutation route. Read routes need no pipe. `DELETE` returns `204`. Never imports repository. Never contains business logic.

Every controller MUST carry full Swagger decorators:

```typescript
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { createZodDto } from 'nestjs-zod';
import {
  ApiTags, ApiBearerAuth,
  ApiCreatedResponse, ApiOkResponse, ApiNoContentResponse,
  ApiNotFoundResponse, ApiBadRequestResponse,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('{module}s')
@ApiBearerAuth()
@Controller('{module}s')
@UseGuards(JwtAuthGuard, CaslGuard)
export class {Module}Controller {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: {Module}Response })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async create(
    @Body(new ZodValidationPipe(Create{Module}Schema)) dto: Create{Module}Dto,
  ): Promise<{Module}Response> {
    return this.commandBus.execute(new Create{Module}Command(dto));
  }

  @Get()
  @ApiOkResponse({ type: [{Module}Response] })
  findAll(): Promise<{Module}Response[]> {
    return this.queryBus.execute(new Get{Module}ListQuery());
  }

  @Get(':id')
  @ApiOkResponse({ type: {Module}Response })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<{Module}Response> {
    return this.queryBus.execute(new Get{Module}ByIdQuery(id));
  }

  @Patch(':id')
  @ApiOkResponse({ type: {Module}Response })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(Update{Module}Schema)) dto: Update{Module}Dto,
  ): Promise<{Module}Response> {
    return this.commandBus.execute(new Update{Module}Command(id, dto));
  }

  @Delete(':id')
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.commandBus.execute(new Delete{Module}Command(id));
  }
}
```

Response type must also use `createZodDto` so Swagger renders the output schema:

```typescript
// application/dtos/{module}.response.ts
export const {Module}ResponseSchema = z.object({
  id:        z.string().uuid(),
  name:      z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export class {Module}Response extends createZodDto({Module}ResponseSchema) {}
```

---

### `{module}.module.ts`

```typescript
import { CqrsModule } from '@nestjs/cqrs';

const CommandHandlers = [Create{Module}Handler, Update{Module}Handler, Delete{Module}Handler];
const QueryHandlers = [Get{Module}ByIdHandler, Get{Module}ListHandler];

@Module({
  imports: [CqrsModule],
  controllers: [{Module}Controller],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: {MODULE}_REPOSITORY, useClass: Prisma{Module}Repository },
  ],
})
export class {Module}Module {}
```

---

## 🔄 Request Flow (Simple CQRS)

```
HTTP Request
  └─► JwtAuthGuard              (core/guards)
  └─► CaslGuard                 (core/guards)
  └─► ZodValidationPipe         (core/pipes) — POST/PATCH only
  └─► Controller (injects CommandBus + QueryBus)
        │
        ├─► [READ] queryBus.execute(new Get{Module}ByIdQuery(id))
        │       └─► @QueryHandler → repository.findById()
        │             └─► null → NotFoundException
        │
        └─► [WRITE] commandBus.execute(new Create{Module}Command(dto))
                └─► @CommandHandler → repository.create()
                      └─► Prisma → PostgreSQL
        └─► global-exception.filter maps exceptions → RFC 7807
```

---

## 📐 Rules (NEVER break)

```
✅ Repository     ← ONLY file that imports PrismaService / generated Prisma types
✅ Handlers       ← write logic (CommandHandler) or read logic (QueryHandler)
✅ Controller     ← dispatches via CommandBus/QueryBus only — never injects handlers
✅ DTO            ← Zod schema + inferred type. No class-validator.
✅ Entity         ← plain TypeScript interface in domain/. No ORM decorators.
✅ Port           ← I{Module}Repository in domain/ports/. Implemented in infrastructure/
✅ Null returns   ← repository returns null (not undefined) when row not found
✅ NotFoundException thrown in CommandHandler/QueryHandler — not in repository

❌ Controller calling Repository directly — always dispatch via Bus
❌ Controller injecting Handlers directly — always via CommandBus/QueryBus
❌ Business logic in Controller or Repository — belongs in Handler
   (if it grows complex: upgrade to `ARCHITECTURE-NEST/SKILL.md`)
❌ Zod schema defined inline in Controller — always in dtos/ file
❌ any / unknown return types — always return typed entity
❌ console.log / console.warn — always use LoggerService
❌ Repository throwing HttpException — return null, let Handler throw
❌ Repository returning undefined — always null (explicit type + JSON-safe)
❌ Domain events in this layout — upgrade to full Hex/DDD if needed
❌ @UsePipes per route if APP_PIPE global is already registered
```

---

## 📦 Shared Infrastructure (consumed by all modules)

> Cross-cutting concerns live in `src/shared/` and are injected into any handler — **regardless of whether the module is simple CQRS or full Hex/DDD**. You do NOT need to upgrade architecture to use them. See `.claude/skills/ARCHITECTURE-NEST/SKILL.md` for the full `shared/` tree.

| Concern | Folder | Inject in handler as | Use case |
|---|---|---|---|
| Logger | `shared/logger` (or `nestjs-pino`) | `LoggerService` | Always — never `console.log` |
| Request context | `shared/cls` (`nestjs-cls`) | `ClsService` | traceId / correlationId propagation |
| Activity log | `shared/activity-log` | `IAuditPort` | Optional: manual call in write handlers |
| Backup DB | `shared/backup` | (scheduler runs autonomously) | Cron-driven — no module integration needed |
| Excel export | `shared/export` | `IExcelExporter` via `ExportService` | Inject in handler, call from a `GET /{module}/export?format=xlsx` route |
| PDF export | `shared/export` | `IPdfExporter` (PDFKit adapter) | Same as Excel. PDFKit is the only PDF engine. |
| Circuit breaker | `shared/external` (cockatiel) | via `@CircuitBreaker('name')` decorator | Wraps ANY outbound HTTP call |
| AI clients | `shared/external/ai` | `IAiClient` | OpenAI / Anthropic — already CB-wrapped |
| FastAPI client | `shared/external/fastapi` | `IFastapiClient` | Internal Python services — already CB-wrapped |
| Queues (BullMQ) | `shared/messaging` | `@InjectQueue('name')` | Heavy/async work (AI batch, exports >10k rows, email blast) |
| WebSockets | `shared/websockets` | `WsRoomsService` + `@WebSocketGateway()` on a `{module}.gateway.ts` | Real-time broadcasts after a mutation. |

> **Rule:** A simple CQRS module stays simple when it consumes shared infra. It only upgrades to `.claude/skills/ARCHITECTURE-NEST/SKILL.md` when its **domain logic** outgrows "validate + save".

---

## ⬆️ Upgrade Triggers — migrate to `ARCHITECTURE-NEST/SKILL.md` when

- You need **domain events** (e.g. `user.created` triggers something elsewhere)
- You need **cross-context coordination** (ACL adapters)
- Business rules grow beyond "validate + save" (state machines, approval flows, multi-step workflows)
- Any handler exceeds ~20 lines of logic
- The entity needs invariants enforced in one place (Value Objects, aggregate factories)

> ❌ Do NOT upgrade just because you need: exports, WebSockets, AI calls, FastAPI integration, audit log, backup. Those are **shared/ infra**, not architecture decisions — see the table above.

The repository, DTO, and command/query layers migrate as-is — no rewrite needed.
