# BACKEND-NEST.md — NestJS 11 · TypeScript 5.x · Enterprise Backend (2026)

> **Authority**: SINGLE SOURCE OF TRUTH for all NestJS/TypeScript rules, patterns, naming, testing, logging, cache, and exports.
> **Pattern**: Hexagonal Architecture + DDD + CQRS — CommandBus/QueryBus dispatch (`@nestjs/cqrs`), Port/Adapter, Domain Events via EventEmitter2.
> **For directory trees and bounded context structure → see `.claude/skills/ARCHITECTURE-NEST/SKILL.md`.**
> **Security baseline → see `.claude/skills/OWASP/SKILL.md` and apply it to every endpoint, use case, adapter, and external integration.**
> **Stack**: NestJS 11.1.x · Prisma 7.x (`prisma-client` generator + `@prisma/adapter-pg`) · Zod 4.x · nestjs-cls 6.x · cockatiel 3.x · BullMQ 5.x · @nestjs/event-emitter 3.x · @nestjs/cqrs 11.x

---

## ⚠️ Key Changes in NestJS 11 (2026)

- `ParseDatePipe` is now native in `@nestjs/common`.
- `IntrinsicException`: exceptions the framework does NOT log automatically.
- `ConfigService.get()` reads config factories before `process.env` (+ `skipProcessEnv` option).
- Module key generation without hash → faster startup for large dynamic modules.
- WebSocket Gateway LifecycleHooks: `onGatewayInit`, `onGatewayConnection`, `onGatewayDisconnect`.
- Express v5 + Fastify v5 upgraded internally.
- `@nestjs/cache-manager 3.0` — breaking changes: no `CacheModule.register()`, uses cache-manager v6 with Keyv.
- `@nestjs/config 4.0` — minor breaking changes.
- `@nestjs/bullmq` — native BullMQ v5 support (Redis Streams, job priorities, rate limits).
- Socket.io v4 + `@socket.io/redis-adapter` v8 for multi-instance pub/sub.
- `@nestjs/cqrs` v11 — **adopted for ALL Hex/DDD modules**. Controllers dispatch via `CommandBus`/`QueryBus`. Command/Query Handlers replace the old Use Case `@Injectable()` pattern. Domain Events still use `EventEmitter2` (not CQRS `EventBus`). CRUD modules do NOT use CQRS.

---

## §0 — TypeScript Strict Protocol

- **Target**: TypeScript strict mode exclusively. NEVER relax strictness for convenience.
- **Validation gate**: Before writing ANY block — _"Is this type-safe? Am I using the most modern NestJS 11 form?"_
- **Legacy code**: If existing code uses `any`, `@ts-ignore`, or `class-validator` — do NOT imitate it. Refactor immediately.
- **Strict types**: `"strict": true` in `tsconfig.json` — no exceptions.
- **Return types**: Every public method MUST have an explicit return type annotation.
- **No `any`**: Use `unknown` and narrow with Zod. Never cast with `as any`.

---

## §1 — TypeScript Patterns (Required)

### CQRS — Command & Query Handlers (Hex/DDD modules)

Every write operation is a **Command** dispatched via `CommandBus`. Every read operation is a **Query** dispatched via `QueryBus`. Handlers implement `ICommandHandler<T>` or `IQueryHandler<T>` from `@nestjs/cqrs`.

#### Command (payload class — plain TS, no NestJS deps)

```typescript
// application/commands/impl/create-project.command.ts
export class CreateProjectCommand {
  constructor(
    public readonly clientId: string,
    public readonly address: string,
    public readonly roofType: string,
    public readonly estimatedArea: number,
    public readonly actorId: string,
  ) {}
}
```

#### Command Handler (write logic — replaces write Use Case)

```typescript
// application/commands/handlers/create-project.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@CommandHandler(CreateProjectCommand)
export class CreateProjectHandler implements ICommandHandler<CreateProjectCommand> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: CreateProjectCommand): Promise<string> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CreateProjectHandler start', { traceId });

    const project = Project.create(command);
    await this.repo.save(project);

    await this.audit.log({
      action: 'projects.created',
      actorId: command.actorId,
      resourceId: project.id.value,
      traceId,
    });

    this.eventEmitter.emit('project.created', new ProjectCreatedEvent(project.id.value));
    this.logger.info('CreateProjectHandler end', { traceId, projectId: project.id.value });

    return project.id.value;
  }
}
```

#### Query (payload class — plain TS)

```typescript
// application/queries/impl/get-project-by-id.query.ts
export class GetProjectByIdQuery {
  constructor(public readonly projectId: string) {}
}
```

#### Query Handler (read logic — replaces read Use Case)

```typescript
// application/queries/handlers/get-project-by-id.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';

@QueryHandler(GetProjectByIdQuery)
export class GetProjectByIdHandler implements IQueryHandler<GetProjectByIdQuery> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(query: GetProjectByIdQuery): Promise<ProjectReadModel | null> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetProjectByIdHandler', { traceId, projectId: query.projectId });
    return this.repo.findById(query.projectId);
  }
}
```

### Controller — Dispatches via CommandBus / QueryBus

```typescript
// infrastructure/api/controllers/projects.controller.ts
import { CommandBus, QueryBus } from '@nestjs/cqrs';

@Controller('projects')
@UseGuards(JwtAuthGuard, CaslGuard)
export class ProjectsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @CheckAbilities({ action: Action.Create, subject: 'PROJECT' })
  async create(
    @Body(new ZodValidationPipe(CreateProjectSchema)) dto: CreateProjectDto,
    @CurrentUser() user: UserJwtPayload,
  ): Promise<ProjectResponse> {
    const id = await this.commandBus.execute(
      new CreateProjectCommand(dto.clientId, dto.address, dto.roofType, dto.estimatedArea, user.id),
    );
    return { id };
  }

  @Get(':id')
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'PROJECT' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectResponse> {
    const project = await this.queryBus.execute(new GetProjectByIdQuery(id));
    if (!project) throw new NotFoundException();
    return ProjectPresenter.toResponse(project);
  }
}
```

### REST & Swagger (OpenAPI) — Mandatory, no GraphQL

- **Only REST architecture is permitted.** `@nestjs/graphql` is strictly banned.
- Swagger is driven entirely by Zod via `nestjs-zod` — no manual `@ApiProperty()` decorators.
- Import `createZodDto` from `'nestjs-zod'` — NOT `'nestjs-zod/dto'` (subpath removed in v5).
- nestjs-zod v5 **removed `patchNestjsSwagger()`**. Instead, pass the generated document through `cleanupOpenApiDoc()` from `'nestjs-zod'` BEFORE `SwaggerModule.setup()` — without it Swagger shows empty/incorrect schemas. (v5 uses `z.toJSONSchema()` internally.)

#### main.ts — Swagger bootstrap (required)

```typescript
import { cleanupOpenApiDoc } from 'nestjs-zod'; // v5 — replaces patchNestjsSwagger
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('API')
    .setDescription('REST API — OpenAPI 3.0')
    .setVersion('1.0')
    .addBearerAuth()  // enables @ApiBearerAuth() on controllers
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // ⚠️ nestjs-zod v5: clean the doc BEFORE setup (no more patchNestjsSwagger).
  // { version: '3.0' } emits `nullable: true` instead of OpenAPI 3.1 `anyOf [null]`.
  SwaggerModule.setup('api', app, cleanupOpenApiDoc(document, { version: '3.0' }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

#### Input DTOs — `createZodDto`

```typescript
// application/dtos/create-project.dto.ts
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod'; // ← from 'nestjs-zod', never '/dto'

export const CreateProjectSchema = z.object({
  clientId:      z.string().uuid(),
  address:       z.string().min(5).max(255),
  roofType:      z.enum(['SHINGLE', 'METAL', 'TILE', 'FLAT']),
  estimatedArea: z.number().positive(),
});

export class CreateProjectDto extends createZodDto(CreateProjectSchema) {}
```

#### Response presenters — `createZodDto` (output shape visible in Swagger)

```typescript
// infrastructure/api/presenters/project.response.ts
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ProjectResponseSchema = z.object({
  id:            z.string().uuid(),
  clientId:      z.string().uuid(),
  address:       z.string(),
  status:        z.string(),
  createdAt:     z.string().datetime(),
  updatedAt:     z.string().datetime(),
});

export class ProjectResponse extends createZodDto(ProjectResponseSchema) {}
```

#### Controller — full Swagger annotation pattern

```typescript
import {
  ApiTags, ApiBearerAuth,
  ApiCreatedResponse, ApiOkResponse, ApiNoContentResponse,
  ApiNotFoundResponse, ApiBadRequestResponse, ApiUnauthorizedResponse,
  ApiParam, ApiQuery,
} from '@nestjs/swagger';

@ApiTags('projects')   // groups routes in Swagger UI
@ApiBearerAuth()       // shows padlock — needs addBearerAuth() in DocumentBuilder
@Controller('projects')
@UseGuards(JwtAuthGuard, CaslGuard)
export class ProjectsController {

  @Post()
  @ApiCreatedResponse({ type: ProjectResponse })   // POST → 201
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse()
  @CheckAbilities({ action: Action.Create, subject: 'PROJECT' })
  async create(
    @Body(new ZodValidationPipe(CreateProjectSchema)) dto: CreateProjectDto,
  ): Promise<ProjectResponse> { ... }

  @Get()
  @ApiOkResponse({ type: [ProjectResponse] })      // array → wrap type in []
  @ApiQuery({ name: 'page',  required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'PROJECT' })
  findAll(@Query() query: ProjectFiltersDto): Promise<ProjectListResponse> { ... }

  @Get('export')     // ← MUST be before /:id to avoid route shadowing
  @ApiOkResponse({ description: 'Binary file', content: { 'application/octet-stream': {} } })
  @ApiQuery({ name: 'format', enum: ['xlsx', 'pdf'], required: true })
  @SkipCache()
  @CheckAbilities({ action: Action.Read, subject: 'PROJECT' })
  async export(@Query('format') format: 'xlsx' | 'pdf'): Promise<StreamableFile> { ... }

  @Get(':id')
  @ApiOkResponse({ type: ProjectResponse })
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'PROJECT' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectResponse> { ... }

  @Patch(':id')
  @ApiOkResponse({ type: ProjectResponse })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CheckAbilities({ action: Action.Update, subject: 'PROJECT' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateProjectSchema)) dto: UpdateProjectDto,
  ): Promise<ProjectResponse> { ... }

  @Delete(':id')
  @ApiNoContentResponse()    // DELETE → 204
  @ApiNotFoundResponse()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @HttpCode(204)
  @CheckAbilities({ action: Action.Delete, subject: 'PROJECT' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> { ... }
}

// ❌ FORBIDDEN
import { IsString, IsUUID } from 'class-validator';
import { ObjectType, Field } from '@nestjs/graphql';
import { createZodDto } from 'nestjs-zod/dto'; // wrong subpath in v5
```

### Prisma Schema — `updated_at` and DB Triggers

`supabase_schema.sql` manages `updated_at` via a PostgreSQL trigger (`trigger_set_updated_at`). For these tables, **NEVER** use Prisma's `@updatedAt` directive in `schema.prisma` — it would cause a redundant app-side write that races the trigger.

```prisma
// ✅ CORRECT — updated_at managed by DB trigger (users, roles, appointments, ...)
updatedAt DateTime @default(now()) @map("updated_at") @db.Timestamp(6)

// ❌ WRONG — do NOT add @updatedAt for trigger-managed tables
updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

// ✅ OK — use @updatedAt ONLY for new tables you create WITHOUT a DB trigger
updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamp(6)
```

`otp_codes` has NO `updated_at` column — it is append-only. Never add `updatedAt` to its Prisma model.

UUID v7 primary keys are produced by the DB-side function `uuid_generate_v7()`:

```prisma
id String @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
```

The extension `pgcrypto`, the function `uuid_generate_v7()`, all `set_updated_at_*` triggers and partial indexes (`WHERE` clauses) live in `prisma/bootstrap.sql` and are applied via `npx prisma db execute --file prisma/bootstrap.sql`. Prisma migrations only own the table/column shape.

### Prisma Schema + Mapper Pattern

Mapper is the ONLY contact between domain entity and Prisma row. Never expose Prisma row types outside `infrastructure/`. Row types come from the **generated** client, never from `@prisma/client`:

```typescript
// infrastructure/persistence/mappers/project.mapper.ts
import type { Project as ProjectRow, Prisma } from '../../../../generated/prisma/client';

export class ProjectMapper {
  static toDomain(row: ProjectRow): Project { ... }
  static toPersistence(entity: Project): Prisma.ProjectUncheckedCreateInput { ... }
  static toReadModel(row: ProjectRow): ProjectReadModel { ... }
}
```

### Domain Entities — Pure TypeScript (zero NestJS/Prisma imports)

```typescript
// domain/entities/project.aggregate.ts
export class Project {
  constructor(
    public readonly id: ProjectId,
    private _status: ProjectStatus,
  ) {}

  approve(): void {
    if (this._status !== ProjectStatus.PENDING)
      throw new ProjectDomainException(`Cannot approve from ${this._status}`);
    this._status = ProjectStatus.APPROVED;
  }
}
```

### Domain Events — Plain TypeScript Classes

```typescript
// domain/events/project-created.domain-event.ts
export class ProjectCreatedEvent {
  constructor(public readonly projectId: string) {}
}

// UseCase publishes after save:
this.eventEmitter.emit('project.created', new ProjectCreatedEvent(id));

// infrastructure/event-listeners/project-created.listener.ts
@Injectable()
export class ProjectCreatedListener {
  @OnEvent('project.created')
  async handle(event: ProjectCreatedEvent): Promise<void> {
    // side effects: WS emit, BullMQ job, email, etc.
  }
}
```

### Value Objects — Private constructor + static `create()`

```typescript
export class RoofArea {
  private constructor(public readonly value: number) {}

  static create(value: number): RoofArea {
    if (value <= 0 || value > 100_000)
      throw new InvalidRoofAreaException(value);
    return new RoofArea(value);
  }
}

// ❌ FORBIDDEN — public constructor with no validation
export class RoofArea {
  constructor(public readonly value: number) {}
}
```

### nestjs-cls — traceId / correlationId

NEVER pass `traceId` or `correlationId` as method parameters. Always read from CLS.

```typescript
// ✅ CORRECT
const traceId = this.cls.get<string>('traceId');

// ❌ FORBIDDEN
async execute(dto: CreateProjectDto, traceId: string): Promise<string>
```

---

## §2 — CQRS Handler Rules (Hex/DDD modules)

### Command Handlers (write logic)

- Returns `void` or a scalar ID (`string`). NEVER returns a full entity or read model from write operations.
- MUST call `IAuditPort.log()` for EVERY state mutation.
- MUST log INFO at START and END of `execute()`.
- Domain Events published AFTER the repository save succeeds.
- Cache invalidation happens AFTER the repository save.
- Decorated with `@CommandHandler(XxxCommand)` and implements `ICommandHandler<XxxCommand>`.

```typescript
// application/commands/impl/approve-project.command.ts
export class ApproveProjectCommand {
  constructor(
    public readonly projectId: string,
    public readonly actorId: string,
  ) {}
}

// application/commands/handlers/approve-project.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(ApproveProjectCommand)
export class ApproveProjectHandler implements ICommandHandler<ApproveProjectCommand> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheManager: CacheManager,
  ) {}

  async execute(command: ApproveProjectCommand): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ApproveProjectHandler start', { traceId });

    const project = await this.repo.findById(command.projectId);
    if (!project) throw new ProjectNotFoundException(command.projectId);

    project.approve();
    await this.repo.save(project);

    await this.audit.log({
      action: 'projects.approved',
      actorId: command.actorId,
      resourceId: command.projectId,
      traceId,
    });

    await this.cacheManager.del(`projects-service:project:${command.projectId}`);
    this.eventEmitter.emit('project.approved', new ProjectApprovedEvent(command.projectId));

    this.logger.info('ApproveProjectHandler end', { traceId });
  }
}
```

### Query Handlers (read logic)

- Returns a typed read model. NEVER calls `IAuditPort.log()`.
- Uses direct Prisma queries (via the repository) for performance — no aggregate reconstruction.
- MUST log INFO at START only.
- Decorated with `@QueryHandler(XxxQuery)` and implements `IQueryHandler<XxxQuery>`.

```typescript
// application/queries/impl/get-projects-list.query.ts
export class GetProjectsListQuery {
  constructor(public readonly filters: ProjectFilters) {}
}

// application/queries/handlers/get-projects-list.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetProjectsListQuery)
export class GetProjectsListHandler implements IQueryHandler<GetProjectsListQuery> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(query: GetProjectsListQuery): Promise<PaginatedResult<ProjectReadModel>> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetProjectsListHandler', { traceId });
    return this.repo.findAll(query.filters);
  }
}
```

### Event Listeners — Side Effects

- Live in `infrastructure/event-listeners/`.
- Decorated with `@OnEvent('domain.event-name')` from `@nestjs/event-emitter`.
- Handle side effects: notifications, emails, WebSocket broadcasts, BullMQ jobs.
- Must be idempotent — safe to retry.
- Do NOT use `@nestjs/cqrs` `EventBus` — always `EventEmitter2`.

---

## §3 — Port / Adapter Pattern

### Port — defined in `domain/ports/`

```typescript
export interface IProjectRepository {
  findById(id: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
  delete(id: string): Promise<void>;
}
export const PROJECT_REPOSITORY = Symbol('IProjectRepository');
```

### Adapter — implemented in `infrastructure/`

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { ProjectMapper } from '../mappers/project.mapper';

@Injectable()
export class PrismaProjectRepository implements IProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Project | null> {
    const row = await this.prisma.project.findUnique({ where: { id } });
    return row ? ProjectMapper.toDomain(row) : null;
  }

  async save(project: Project): Promise<void> {
    const data = ProjectMapper.toPersistence(project);
    await this.prisma.project.upsert({
      where:  { id: project.id.value },
      create: data,
      update: data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }
}
```

### Module binding (CQRS)

```typescript
import { CqrsModule } from '@nestjs/cqrs';

const CommandHandlers = [
  CreateProjectHandler,
  ApproveProjectHandler,
  ExportProjectsHandler,
];
const QueryHandlers = [
  GetProjectByIdHandler,
  GetProjectsListHandler,
];

@Module({
  imports: [CqrsModule, EventEmitterModule],
  controllers: [ProjectsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ProjectCreatedListener,
    { provide: PROJECT_REPOSITORY, useClass: PrismaProjectRepository },
    { provide: AUDIT_PORT, useClass: ActivityLogAuditAdapter },
  ],
})
export class ProjectsModule {}
```

> **Note**: `CqrsModule.forRoot()` must be registered once in `AppModule`. Feature modules import `CqrsModule` (without `.forRoot()`).

### Transactional Adapter (`@nestjs-cls/transactional-adapter-prisma`)

Use this adapter when a Use Case must run multiple repository calls inside a single transaction without leaking `prisma.$transaction()` calls into `application/`. The adapter binds the transaction to the CLS context, so repositories transparently use the active transactional client.

```typescript
// shared/database/database.module.ts
import { Module } from '@nestjs/common';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ClsModule } from 'nestjs-cls';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ClsModule.forRoot({
      plugins: [
        new ClsPluginTransactional({
          imports: [DatabaseModule],
          adapter: new TransactionalAdapterPrisma({ prismaInjectionToken: PrismaService }),
        }),
      ],
      middleware: { mount: true },
    }),
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}

// application/use-cases/approve-project.use-case.ts
import { Transactional } from '@nestjs-cls/transactional';

@Injectable()
export class ApproveProjectUseCase {
  @Transactional()
  async execute(projectId: string): Promise<void> {
    // Every repo call inside here joins the same TX automatically.
  }
}
```

Use `prisma.$transaction()` directly only when you need the interactive callback form (e.g. branching on intermediate results inside `infrastructure/persistence/`). Never mix both styles in the same Use Case.

---

## §4 — IAuditPort — Two-Level Strategy

| Event type       | Mechanism                  | When                               |
| ---------------- | -------------------------- | ---------------------------------- |
| HTTP mutations   | `AuditInterceptor`         | Automatic on POST/PATCH/PUT/DELETE |
| Business actions | `IAuditPort` in WriteUseCase | Manual, explicit per action      |

```typescript
export interface IAuditEntry {
  action: string; // e.g. 'projects.approved'
  actorId: string;
  resourceId: string;
  traceId: string;
  metadata?: Record<string, unknown>;
}
export interface IAuditPort {
  log(entry: IAuditEntry): Promise<void>;
}
export const AUDIT_PORT = Symbol('IAuditPort');
```

### Audit Action Naming Convention

```
{module}.{past_tense_verb}

projects.created        projects.approved       projects.completed
estimates.generated     payments.processed
auth.login              auth.logout             auth.token_theft_detected
users.created           users.suspended         users.password_changed
profile.updated         profile.avatar_uploaded
{module}.export         ← always audited, never cached
```

### What MUST NOT be logged (ever)

`password`, `hashedPassword`, `refreshToken`, `accessToken`, `apiKey`, `secret`, `authorization`, full request/response bodies, full SQL queries in production, full stack traces in production.

---

## §5 — Observability & Logging

### Rules

- ALWAYS use injected `LoggerService` — NEVER `console.log`, `console.error`, `console.warn`.
- Every Write UseCase logs INFO at START and END of `execute()`.
- Every Read UseCase logs INFO at START only.
- Every adapter logs: INFO on success, WARN on 4xx, ERROR on 5xx/network failure.
- Every log entry MUST include `traceId` from `cls.get('traceId')`.
- User-facing texts, validation messages, error messages, labels, and repeated literals MUST NOT be hardcoded; extract them into shared constants or a centralized messages source.

```typescript
// ✅ CORRECT
this.logger.info('CreateProjectUseCase start', {
  traceId,
  clientId: dto.clientId,
});
this.logger.warn('External 4xx', {
  traceId,
  statusCode: 400,
  adapter: 'StripeAdapter',
});
this.logger.error('External 5xx', { traceId, error: err.message });

// ❌ FORBIDDEN
console.log('done');
this.logger.error('failed'); // no traceId
```

### Log Redaction — `log-redact.constants.ts`

Pino `redact` list applied globally — never sanitize manually per service:
`password`, `hashedPassword`, `token`, `accessToken`, `refreshToken`, `apiKey`, `secret`, `authorization`, `cookie`, `x-api-key`

### Log Transport

- **Development**: `pino-pretty` colorized to stdout.
- **Production**: raw JSON to stdout → Docker/K8s → Datadog / Grafana Loki / CloudWatch.
- `LOG_LEVEL` env var controls level (default `info` in prod, `debug` in dev).
- Always inject `Logger` from `nestjs-pino` (`import { Logger } from 'nestjs-pino'`) — never instantiate Pino directly. Configure once globally via `LoggerModule.forRoot({...})` in `AppModule`, with `pino-pretty` transport in dev and raw JSON in prod.

---

## §6 — Cache TTL Strategy

Every GET controller method MUST declare a TTL via `@CacheTTL()`. A GET method without TTL is a **blocking issue**. Use `TTL_SECONDS` constants — no magic numbers.

### TTL Tiers

| Tier   | Constant             | Seconds | Use for                                        |
| ------ | -------------------- | ------- | ---------------------------------------------- |
| SHORT  | `TTL_SECONDS.SHORT`  | 30      | Frequently mutated: user lists, order statuses |
| MEDIUM | `TTL_SECONDS.MEDIUM` | 300     | Semi-stable: roles, permissions, preferences   |
| LONG   | `TTL_SECONDS.LONG`   | 3600    | Stable reference: country lists, plan tiers    |
| STATIC | `TTL_SECONDS.STATIC` | 86400   | Immutable: lookup tables, enums, i18n strings  |

### Cache Key Convention

```
{service}:{entity}:{identifier}:{params_hash}

users-service:user:abc-123
users-service:users:list:{sha1_of_filters_and_page}
rbac-service:permissions:user:abc-123
```

Key construction is owned by `CacheTTLInterceptor` — controllers never build cache keys manually.

### Cache Invalidation Rules

- Write UseCase MUST invalidate related cache keys after `repo.save()` succeeds.
- Use `CacheManager.del(key)` for precise removal or `SCAN + DEL` via ioredis for lists.
- `CacheManager.reset()` (flush all) is **forbidden** in production.
- `AuditInterceptor` does NOT invalidate cache — WriteUseCase owns it.

### TTL Reference

| Controller GET method       | TTL                  |
| --------------------------- | -------------------- |
| `GET /users/:id`            | `TTL_SECONDS.SHORT`  |
| `GET /users`                | `TTL_SECONDS.SHORT`  |
| `GET /roles`                | `TTL_SECONDS.LONG`   |
| `GET /countries`            | `TTL_SECONDS.STATIC` |
| `GET /users/export`         | `@SkipCache()`       |

### What MUST NOT be Cached

- Export endpoints (`GET /{entity}/export`) — always fresh.
- `GET /health` — must reflect live state.
- Any POST/PATCH/PUT/DELETE response.
- Any route marked with `@SkipCache()`.

---

## §7 — Export (Excel + PDF) — Mandatory on Every CRUD

Every entity with a list endpoint MUST also expose `GET /{entities}/export?format=xlsx|pdf`.

### Export Flow

```
GET /projects/export?format=xlsx
  └─► Controller.export(format, filters)
        └─► ExportProjectsUseCase.execute(filters, format)
              ├─► Fetches all matching rows (no pagination)
              ├─► ExportService.generate(rows, format, @ExportColumn metadata)
              │     ├─► 'xlsx' → ExcelExporterService → Buffer
              │     └─► 'pdf'  → PdfExporterService   → Buffer
              └─► IAuditPort.log({ action: 'projects.export', properties: { format, rowCount } })
        └─► Controller streams buffer with Content-Disposition header
```

### ExcelExporterService Rules

- Uses `ExcelJS` only — never the `xlsx` package.
- Header row: bold font, accent background, auto-fit column width.
- Column labels come from `@ExportColumn({ label })` on ReadModel — never hardcoded.
- Dates formatted as `YYYY-MM-DD HH:mm UTC`.
- Sensitive fields (`password`, `token`, `secret`) MUST NOT have `@ExportColumn`.
- Datasets > 10k rows use worksheet streaming mode.

### PdfExporterService Rules

- Uses **PDFKit** only (lightweight, streaming). Puppeteer is explicitly NOT used in this project — kept off the dependency tree to avoid the Chromium footprint.
- Every PDF includes: entity name, export date, applied filters, total row count, data table.
- Header/footer includes page number and org logo.
- Minimum font size 10pt. Tables paginate automatically.
- Column labels from same `@ExportColumn` metadata as Excel.

### Export Checklist

- [ ] Export route registered BEFORE `/:id` in controller
- [ ] Same `FilterDTO` reused for list and export
- [ ] `IAuditPort.log()` called with `action: '{module}.export'`
- [ ] `@SkipCache()` applied — export buffers never cached
- [ ] `@Throttle()` — max 1 export per user per 30 seconds
- [ ] Sensitive fields have no `@ExportColumn` decorator

---

## §8 — Security (OWASP Top 10:2025 / OWASP API Security Top 10:2023)

> **Mandatory baseline**: follow `.claude/skills/OWASP/SKILL.md` for all security design and implementation decisions.

| Category                  | Mitigation                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Broken Access Control     | 2-layer guards: `JwtAuthGuard` → `CaslGuard`. Deny by default. `ParseUUIDPipe` on all UUID params.                 |
| Security Misconfiguration | `helmet()` global in `main.ts`. CORS per environment. `APP_ENV` checked at bootstrap.                               |
| Injection                 | Prisma parameterized queries only (`$queryRaw` ONLY via `Prisma.sql` tagged template or TypedSQL). Zod validates ALL input. No `eval()`. |
| Crypto Failures           | `bcrypt` for passwords. HTTPS only. Never log tokens/passwords/PII.                                                 |
| Auth Failures             | JWT + Passport. Refresh token rotation. Token theft detection via revoke.                                           |
| Logging Failures          | Pino structured logs. `nestjs-cls` traceId in all entries. `AuditPort` in write use cases.                          |
| CSRF                      | `csrf-csrf` — never deprecated `csurf`.                                                                             |
| XSS                       | `sanitize-html` — never deprecated `xss-clean`.                                                                     |
| Ownership / IDOR          | `CaslGuard` + `@CheckAbilities()` — Configured dynamically via DB permissions and Field-Level Security.             |

---

## §9 — Testing Strategy

| Layer             | Type        | Tools                                | Rule                                       |
| ----------------- | ----------- | ------------------------------------ | ------------------------------------------ |
| `domain/`         | Unit        | Jest / Vitest                        | ZERO NestJS/Prisma imports                 |
| `application/`    | Unit        | Jest + in-memory ports               | Mock `IRepository` + `MockAuditPort`       |
| `infrastructure/` | Integration | Jest + `@testcontainers/postgresql`  | Real DB in isolated container              |
| HTTP endpoints    | E2E         | `@nestjs/testing` + Supertest        | Full app with test DB                      |
| WebSocket         | Integration | Socket.io client + `@nestjs/testing` | Real WS, test Redis                        |
| Export            | Integration | Buffer assertions on generated file  | Real ExcelJS/PDFKit, mock rows             |
| Cache             | Unit        | MockCacheManager + TTL assertion     | No Redis needed                            |
| Logging           | Unit        | MockLoggerService + spy assertions   | Verify correct level + fields              |

### Key Testing Rules

- Domain unit tests MUST NOT import from NestJS, Prisma, or any `infrastructure/` file.
- Every Write UseCase test MUST verify `IAuditPort.log()` called with correct `action`.
- Every Write UseCase test MUST verify `LoggerService.info()` called at start AND end of `execute()`.
- Every Read UseCase test MUST NOT call `IAuditPort.log()`.
- Every Export UseCase test MUST assert: buffer non-empty + correct column headers + audit logged.
- Every BullMQ processor test MUST verify `LoggerService.error()` called when job throws, with `jobId` + `traceId`.
- Every Circuit Breaker test MUST verify `LoggerService.warn()` called when circuit opens.
- Backup service tests MUST use mock `IBackupStoragePort` — never call real S3 in unit tests.

---

## §10 — Naming Conventions

| Type                 | Convention                              | Example                                     |
| -------------------- | --------------------------------------- | ------------------------------------------- |
| Aggregate            | `*.aggregate.ts`                        | `project.aggregate.ts`                      |
| Value Object         | `*.vo.ts`                               | `roof-area.vo.ts`                           |
| Domain Event         | `*.domain-event.ts`                     | `project-approved.domain-event.ts`          |
| Event Listener       | `*.listener.ts`                         | `project-created.listener.ts`               |
| Repository interface | `I` prefix + `.repository.interface.ts` | `project.repository.interface.ts`           |
| Repository impl      | `prisma-*.repository.ts`                | `prisma-project.repository.ts`              |
| Command (payload)    | `{verb}-{module}.command.ts`            | `commands/impl/create-project.command.ts`   |
| Command Handler      | `{verb}-{module}.handler.ts`            | `commands/handlers/create-project.handler.ts` |
| Query (payload)      | `get-{module}-{qualifier}.query.ts`     | `queries/impl/get-project-by-id.query.ts`   |
| Query Handler        | `get-{module}-{qualifier}.handler.ts`   | `queries/handlers/get-project-by-id.handler.ts` |
| Export Command       | `export-{module}.command.ts`            | `commands/impl/export-projects.command.ts`  |
| Read Model           | `*.read-model.ts`                       | `project.read-model.ts`                     |
| Input DTO            | `*.dto.ts`                              | `create-project.dto.ts`                     |
| Presenter            | `*.response.ts`                         | `project.response.ts`                       |
| WS Gateway           | `*.gateway.ts`                          | `project.gateway.ts`                        |
| REST Controller      | `*.controller.ts`                       | `projects.controller.ts`                    |
| Port interface       | `I` prefix + `.port.ts`                 | `audit.port.ts` → exports `IAuditPort`      |
| Adapter              | `*-[tech].adapter.ts`                   | `s3-backup-storage.adapter.ts`              |
| ACL Mapper           | `*.mapper.ts`                           | `project.mapper.ts`                         |
| Schema (Prisma)      | `*.prisma` (under `prisma/schema/`)     | `projects.prisma`                           |
| Exporter service     | `*-exporter.service.ts`                 | `excel-exporter.service.ts`                 |

---

## §11 — Package Mapping (verified March 2026)

| Purpose         | Package                                                                      | Version       |
| --------------- | ---------------------------------------------------------------------------- | ------------- |
| Framework       | `@nestjs/core`, `@nestjs/common`                                             | ^11.1.14      |
| CQRS            | `@nestjs/cqrs`                                                               | ^11.0.3       |
| Events          | `@nestjs/event-emitter`                                                      | ^3.x          |
| ORM             | `prisma@^7`, `@prisma/client@^7`, `@prisma/adapter-pg@^7`, `pg`              | ^7.6.x        |
| Validation      | `zod@^4`, `nestjs-zod@^5`                                                    | 4.3.6 / 5.1.1 |
| API Docs (REST) | `@nestjs/swagger`                                                            | ^11.x         |
| Auth            | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`, `@casl/ability` | ^11.x / ^6.x  |
| WebSockets      | `@nestjs/websockets`, `socket.io`, `@socket.io/redis-adapter@^8`             | ^11.x         |
| Jobs            | `bullmq@^5`, `@nestjs/bullmq@^11`                                            | 5.70.1        |
| Cache           | `@nestjs/cache-manager@^3`, `ioredis`                                        | ^3.x          |
| Request context | `nestjs-cls@^6`, `@nestjs-cls/transactional@^3`                              | 6.2.0         |
| Resilience      | `cockatiel@^3`                                                               | 3.2.1         |
| Scheduling      | `@nestjs/schedule`                                                           | ^6.1.x        |
| Export Excel    | `exceljs`                                                                    | ^4.4.x        |
| Export PDF      | `pdfkit`                                                                     | ^0.18.x       |
| Backup          | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`                        | ^3.x          |
| Health          | `@nestjs/terminus@^11`                                                       | ^11.x         |
| Observability   | `@opentelemetry/sdk-node`, `pino`, `pino-http`, `nestjs-pino`                | latest        |
| Authorization   | `@casl/ability`                                                              | ^6.x          |
| Compiler        | `@swc/core`, `@swc/cli`                                                      | latest        |
| Config          | `@nestjs/config@^4`                                                          | ^4.x          |
| Security        | `helmet`, `csrf-csrf`, `sanitize-html`, `hpp`                                | latest        |
| Throttling      | `@nestjs/throttler`                                                          | ^6.5.x        |

> ✅ `@nestjs/cqrs` v11 — **adopted for ALL Hex/DDD modules**. `CommandBus`/`QueryBus` dispatch in controllers. `EventEmitter2` remains for domain events. CRUD modules do NOT use CQRS — they keep the Service/Repository pattern.

---

## §12 — Common Errors

| Error                                      | Fix                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Swagger shows empty `{}` schema for DTOs   | nestjs-zod v5: wrap the doc in `cleanupOpenApiDoc(document, { version: '3.0' })` before `SwaggerModule.setup()` (`patchNestjsSwagger` removed in v5) |
| `createZodDto` import error in v5          | Use `from 'nestjs-zod'` — the `/dto` subpath was removed in nestjs-zod v5                  |
| POST returns 201 but Swagger docs say 200  | Use `@ApiCreatedResponse()` instead of `@ApiOkResponse()` on POST handlers                 |
| DELETE route not showing 204 in Swagger    | Use `@ApiNoContentResponse()` and `@HttpCode(204)` — not `@ApiOkResponse()`                |
| Handler dependency `undefined` at runtime  | Ensure Handler is in `providers[]` of its module and `CqrsModule` is imported              |
| `EventEmitter2` not injected in Handler   | Import `EventEmitterModule.forRoot()` in `AppModule`, inject `EventEmitter2` in handler    |
| `@OnEvent()` listener not triggered        | Ensure listener class is in `providers[]` and module is imported                           |
| Prisma client import error                 | Import from `./generated/prisma/client` (the generator's `output` path) — NOT from `@prisma/client` in Prisma 7 |
| `ClsService.get()` returns `undefined`     | Ensure `ClsModule.forRoot({ middleware: { mount: true } })` in `AppModule`                 |
| JWT guard blocks WebSocket handshake       | Use `WsJwtMiddleware` from `shared/websockets/` — not the HTTP guard directly              |
| `cache-manager` Redis error in v3          | Use `ioredis` directly — `cache-manager-redis-store` incompatible with cache-manager v6    |
| `@nestjs/config@4` env var not found       | `ConfigService.get()` reads config factories before `process.env` — check factory order    |
| Cache not invalidated after mutation       | Write UseCase owns cache invalidation — not `AuditInterceptor`                             |
| Export returns stale data                  | Add `@SkipCache()` on export controller route                                              |
| `CaslGuard` allows wrong user              | Verify `conditions` in DB JSON matches the Prisma model field EXACTLY (e.g. `userId`)      |
| 403 thrown on SUPER_ADMIN                  | Check that `CaslAbilityFactory` grants `manage, all` to SUPER_ADMIN role                   |
| `@CheckAbilities()` not evaluated          | Guard order matters: `@UseGuards(JwtAuthGuard, CaslGuard)` — CASL evaluates implicitly     |
| Field-Level Security throws 403            | Verify `fields` JSON array in `permissions` table includes the field being updated         |

---

## §13 — Quick Decision Table

| Situation                        | Solution                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| Swagger empty schemas            | `cleanupOpenApiDoc(document, { version: '3.0' })` before `SwaggerModule.setup()` — nestjs-zod v5, replaces `patchNestjsSwagger` (§1) |
| Document POST response in Swagger| `@ApiCreatedResponse({ type: XxxResponse })` — not `@ApiOkResponse()` (§1)           |
| Document DELETE in Swagger       | `@ApiNoContentResponse()` + `@HttpCode(204)` (§1)                                    |
| Expose output schema in Swagger  | Response class extends `createZodDto(ResponseSchema)` — not plain interface (§1)     |
| Input validation                 | Zod v4 schema + `ZodValidationPipe` (§1)                                              |
| Validate env vars at bootstrap   | Zod v4 schema in `shared/config/env.config.ts`                                        |
| Mutate state                     | Command + CommandHandler + `IAuditPort.log()` (§2, §4)                               |
| Read data                        | Query + QueryHandler + direct Prisma (via repository) + `@CacheTTL()` on controller GET (§2, §6) |
| Cross-cutting request context    | `nestjs-cls` `ClsService` (§1)                                                        |
| Transactional DB operation       | `@nestjs-cls/transactional` `@Transactional()` with the Prisma adapter, OR `prisma.$transaction()` for interactive multi-step transactions (§3) |
| External service failure         | `cockatiel` CircuitBreaker + retry (§8)                                               |
| Async side effect after mutation | `@OnEvent()` listener (EventEmitter2) or BullMQ processor (§2)                        |
| Domain invariant violation       | Domain exception from `domain/exceptions/` (§1)                                       |
| Type-safe domain object          | Value Object with private constructor + static `create()` (§1)                        |
| First/last array element         | `array.at(0)` / `array.at(-1)` — never `[0]` on possibly undefined                    |
| Export from any list endpoint    | `ExportXxxCommand` + `@SkipCache()` + audit (§7)                                      |
| GET caching                      | `@CacheTTL(TTL_SECONDS.X)` on controller GET method (§6)                              |
| Restrict route to resource owner | `@CheckAbilities((ability) => ability.can(Action.Read, subject))` + `CaslGuard` (§14) |
| Allow only SUPER_ADMIN to delete | `@CheckAbilities((ability) => ability.can(Action.Delete, 'User'))`                    |

---

## §14 — Authorization (CASL & ABAC)

All route protection MUST be delegated to CASL Abilities based on the database permissions table (`RBAC` + `ABAC`), not hardcoded role checks.

Two guard layers applied in strict order on every mutation route:

```
@UseGuards(JwtAuthGuard, CaslGuard)
              ↓              ↓
         Level 1         Level 2
      Is logged in?    Has CASL ability?
```

### `CaslAbilityFactory` (Single Source of Truth)

The factory fetches BOTH `role_permissions` (from the user's roles) AND `user_permissions` (direct per-user overrides that can GRANT or DENY). Results are cached in Redis. The order matters: role grants first, then user-level rules applied last — a DENY in `user_permissions` always wins.

```typescript
// access/casl-ability.factory.ts
import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  MongoAbility,
} from '@casl/ability';

// Matches Action enum column in permissions table
export enum Action {
  Manage  = 'manage',
  Create  = 'create',
  Read    = 'read',
  Update  = 'update',
  Delete  = 'delete',
  Restore = 'restore',
  Publish = 'publish',
  Assign  = 'assign',
}

// Matches subject column in permissions table (supabase_schema.sql)
export type Subjects =
  | 'USER' | 'ROLE' | 'APPOINTMENT'
  | 'COMPANY' | 'CONTACT' | 'CONTENT'
  | 'ALL';

export type AppAbility = MongoAbility<[Action, Subjects]>;

// Shared row shape returned by both repo methods
export interface PermissionRow {
  action:     string;
  subject:    string;
  conditions: Record<string, unknown> | null;
  fields:     string[] | null;
}

export interface UserPermissionRow extends PermissionRow {
  isGranted: boolean; // maps to user_permissions.is_granted
}

export interface IPermissionRepository {
  // Loads role_permissions for all roles the user currently holds
  getPermissionsForRoles(roleIds: string[]): Promise<PermissionRow[]>;
  // Loads user_permissions direct overrides (is_granted = true OR false)
  getDirectPermissionsForUser(userId: string): Promise<UserPermissionRow[]>;
}

@Injectable()
export class CaslAbilityFactory {
  constructor(
    private readonly repo: IPermissionRepository,
    private readonly cacheManager: CacheManager,
  ) {}

  async createForUser(user: UserJwtPayload): Promise<AppAbility> {
    const cacheKey = `casl:ability:${user.id}`;
    const cached = await this.cacheManager.get<AppAbility>(cacheKey);
    if (cached) return cached;

    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    // 1. Role-based grants (from role_permissions)
    const rolePerms = await this.repo.getPermissionsForRoles(user.roleIds);
    for (const p of rolePerms) {
      const conds = p.conditions ? this.interpolate(p.conditions, user) : undefined;
      can(p.action as Action, p.subject as Subjects, p.fields ?? undefined, conds);
    }

    // 2. User-level overrides (from user_permissions)
    //    is_granted=true  → explicit GRANT (adds to role grants)
    //    is_granted=false → explicit DENY  (overrides any role grant)
    const directPerms = await this.repo.getDirectPermissionsForUser(user.id);
    for (const p of directPerms) {
      const conds = p.conditions ? this.interpolate(p.conditions, user) : undefined;
      if (p.isGranted) {
        can(p.action as Action, p.subject as Subjects, p.fields ?? undefined, conds);
      } else {
        cannot(p.action as Action, p.subject as Subjects, p.fields ?? undefined, conds);
      }
    }

    const ability = build({
      detectSubjectType: (item) => item.constructor as ExtractSubjectType<Subjects>,
    });

    await this.cacheManager.set(cacheKey, ability, TTL_SECONDS.MEDIUM);
    return ability;
  }

  private interpolate(
    conditions: Record<string, unknown>,
    user: UserJwtPayload,
  ): Record<string, unknown> {
    const json = JSON.stringify(conditions).replace(/\$\{user\.id\}/g, user.id);
    return JSON.parse(json) as Record<string, unknown>;
  }
}
```

### `@CheckAbilities()` Decorator

```typescript
export interface RequiredRule {
  action: Action;
  subject: Subjects;
}

export const CHECK_ABILITY = 'check_ability';
export const CheckAbilities = (...requirements: RequiredRule[]) =>
  SetMetadata(CHECK_ABILITY, requirements);
```

### Controller Usage Pattern

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard, CaslGuard)
export class UsersController {

  @Get()
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'USER' })
  findAll(): Promise<UserListResponse> { ... }

  @Get(':id')
  @CacheTTL(TTL_SECONDS.SHORT)
  @CheckAbilities({ action: Action.Read, subject: 'USER' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponse> { ... }

  @Patch(':id')
  @CheckAbilities({ action: Action.Update, subject: 'USER' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
    @Req() req: Request,
  ): Promise<UserResponse> { ... }

  @Delete(':id')
  @CheckAbilities({ action: Action.Delete, subject: 'USER' })
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> { ... }
}
```

### Policy Rules (Non-negotiable)

- Guard order is FIXED: `JwtAuthGuard` → `CaslGuard`. Never reorder.
- NEVER hardcode bypasses like `if (role === 'SUPER_ADMIN')` inside code.
- ALL permissions MUST be loaded from the DB `permissions` / `role_permissions` schema.
- `CaslAbilityFactory` MUST aggressively cache the user's computed CASL object in Redis.
- Field-Level Security MUST be enforced explicitly within the controller when `Action.Update` allows partial payloads.
- `@Roles()` and `@Policy()` are explicitly FORBIDDEN in favor of `@CheckAbilities()`.

### Module Configuration

```typescript
import { CqrsModule } from '@nestjs/cqrs';

const CommandHandlers = [CreateYourHandler, UpdateYourHandler, DeleteYourHandler];
const QueryHandlers = [GetYourByIdHandler, GetYourListHandler];

@Module({
  imports: [CqrsModule, EventEmitterModule],
  controllers: [YourController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    YourEventListener,
    CaslAbilityFactory,
    CaslGuard,
    { provide: YOUR_REPOSITORY, useClass: PrismaYourRepository },
    { provide: AUDIT_PORT, useClass: ActivityLogAuditAdapter },
  ],
})
export class YourModule {}
```

---

## §15 — Frontend Exports & Postman Sync

Upon completing the development of any module or CRUD, it is **MANDATORY** to leave interoperability artifacts ready for the Frontend and Testing teams:

### 1. Types Export for React / Next.js

- Your DTOs created with `zod@^4` already provide pure TypeScript types using `z.infer<typeof Schema>`.
- Explicitly export the `Response` and `Payload` interfaces in an `index.ts` or `contracts` file at the boundary of the `application/` layer so that frontend clients (Next.js/React) can consume them without depending on NestJS backend code.
- **Rule:** Maintain ZERO dependencies on Backend libraries (`@nestjs/*`, `@prisma/client`, the generated `prisma/client`) in the exported type files.

### 2. Postman Collection Export (via Swagger JSON)

- Whenever you add or update a CRUD, you must ensure the endpoints have the `@ApiTags()`, `@ApiBody()`, `@ApiOkResponse()` decorators correctly imported.
- Run the project (`npm run start:dev`) and go to `http://localhost:3000/api-json` (default Swagger OpenAPI v3 route).
- Extract that raw JSON and use it to inject or update your shared Postman "Workspace" with the team, keeping the API fully testable.
- Zero excuses: No PR will be approved for review if the implemented Endpoints are not formally reflected in the models and in the Swagger JSON to import into Postman.
