---
description: Directory structure for complex NestJS modules — Hexagonal/DDD + UseCase pattern (~15 files), with CQRS (CommandBus/QueryBus) as an OPT-IN per bounded context. Use ONLY for bounded contexts with real domain invariants, domain events, ACL, or cross-context coordination. For CRUDs with business logic → see `.windsurf/skills/ARCHITECTURE-DEFAULT/SKILL.md`. For simple lookups → see `.windsurf/skills/ARCHITECTURE-SIMPLE/SKILL.md`.
globs: src/**
---

# ARCHITECTURE-ENTERPRISE — Hexagonal/DDD + UseCase (CQRS opt-in) (2026)

> **Authority**: SINGLE SOURCE OF TRUTH for complex bounded contexts.
> **Pattern (default)**: Hexagonal Architecture + DDD + **UseCase pattern** — one `@Injectable()` UseCase per operation, controllers inject UseCases directly. Port/Adapter for outbound dependencies. Domain Events via `EventEmitter2`.
> **CQRS (`CommandBus` / `QueryBus`)**: **OPT-IN per bounded context** — adopt only when there is a documented justification (saga orchestration, multiple handlers per command, decoupled write/read models). Default Hex/DDD modules do NOT use `@nestjs/cqrs`.
> **When to use this tier**: ONLY when the module has complex business rules, domain events, ACL, or cross-context coordination.
> **For CRUDs with business logic**: use `.windsurf/skills/ARCHITECTURE-DEFAULT/SKILL.md`.
> **For simple lookups**: use `.windsurf/skills/ARCHITECTURE-SIMPLE/SKILL.md`.
> **For coding rules, naming conventions, testing strategy, logging, cache, exports → see `.windsurf/skills/BACKEND-NEST/SKILL.md`.**
> **For DRY patterns reused by Hex/DDD repositories → see `.windsurf/skills/BACKEND-NEST-PATTERNS/SKILL.md`.**
> **Security baseline → see `.windsurf/skills/OWASP/SKILL.md`. Key hits enforced by this tier: API #1 BOLA + #3 BOPLA (domain-level ownership in aggregates + CASL gates), API #4 Unrestricted Resource Consumption (`max(100)` on bulk commands, `take` caps on read models, `@Throttle()` on export commands), OWASP #3 Injection (Zod v4 at boundaries, `Prisma.sql` for raw reports), OWASP #7 Insecure Design (state machines + invariants in aggregates, deny-by-default), OWASP #9 Logging Failures (`IAuditPort.log({..}, { strict: true })` in every write UseCase + `traceId` from CLS).**

---

## 🧭 Quick Decision Guide

> **See [`.windsurf/skills/ARCHITECTURE-DECISION-GUIDE.md`](../ARCHITECTURE-DECISION-GUIDE.md) for the complete decision matrix.**

---

## 📁 Full Service Structure

> **Root tree (`src/main.ts`, `app.module.ts`, `core/`, `shared/`, `logger/`, `modules/`) is identical across DEFAULT and ENTERPRISE.** See `.windsurf/skills/ARCHITECTURE-DECISION-GUIDE.md` for the canonical layout — do not restate per skill. Below is only what is specific to the ENTERPRISE tier (the `modules/{module}/` Hex/DDD template).

---

## 🧩 Module Template — `{YourModule}/` (Domain layer completo, ~15 archivos)

```
modules/{module}/
├── {module}.module.ts
├── {module}.controller.ts
├── domain/
│   ├── {module}.entity.ts          # Aggregate root
│   ├── {module}-id.vo.ts           # Value object (readonly)
│   ├── events/
│   │   └── {module}-created.event.ts
│   └── ports/
│       └── {module}.repository.port.ts  # Interface
├── application/
│   ├── use-cases/
│   │   ├── create-{module}.use-case.ts
│   │   ├── update-{module}.use-case.ts
│   │   ├── delete-{module}.use-case.ts
│   │   ├── restore-{module}.use-case.ts
│   │   ├── bulk-delete-{module}.use-case.ts
│   │   ├── bulk-restore-{module}.use-case.ts
│   │   ├── get-{module}.use-case.ts
│   │   ├── list-{module}.use-case.ts
│   │   └── export-{module}.use-case.ts
│   └── dto/
│       ├── create-{module}.dto.ts
│       ├── update-{module}.dto.ts
│       ├── {module}-filter.dto.ts
│       └── bulk-ids.dto.ts
├── infrastructure/
│   ├── {module}.repository.ts      # Implements port
│   ├── event-listeners/
│   │   └── {module}-created.listener.ts
│   └── mappers/
│       └── {module}.mapper.ts      # Entity ↔ Prisma
└── {module}.spec.ts
```

**Total: ~15 archivos** (solo cuando sea estrictamente necesario)

---

## 📐 Architecture Rules (NEVER break)

### Domain layer completo (solo cuando sea necesario)

```
✅ Domain layer ZERO imports de NestJS, Prisma, HTTP
✅ Application layer solo importa de domain/
✅ Infrastructure implementa interfaces de domain/
✅ UseCases tienen un solo método execute()
✅ Ports definidos en domain/ports/
✅ EventEmitter2 para domain events (NO @nestjs/cqrs EventBus)

❌ Domain imports de NestJS o Prisma
❌ Application imports de infrastructure/
❌ Controller llama UseCases directamente (debe ir por Service)
❌ Domain events antes de repository.save()
❌ Ports para servicios que no varían (usar shared/external/)
```

### Shared layer

> **See [`.windsurf/skills/ARCHITECTURE-DECISION-GUIDE.md`](../ARCHITECTURE-DECISION-GUIDE.md) for shared layer rules.**

### General rules

```
✅ TypeScript strict mode
✅ Zod v4 para validación (NO class-validator)
✅ Prisma v7 ORM (NO Drizzle/TypeORM)
✅ nestjs-cls para traceId/correlationId
✅ @nestjs-cls/transactional para transacciones
✅ IAuditPort en write paths que mutan estado
✅ Cache invalidation después de mutations
✅ Domain events después de repository.save()
✅ BullMQ para jobs en infrastructure/jobs/

❌ any types
❌ @ts-ignore
❌ class-validator/class-transformer
❌ console.log (usar LoggerService)
❌ Hardcoded secrets
❌ Circuit breaker en domain/DB calls
❌ Bulk operations como N single calls
```

---

## 🔄 Migration Path

### De Default → Enterprise

1. **Trigger**: módulo hits uno de los triggers:
   - Invariantes complejas que no caben en Service
   - Domain events requeridos por otros contexts
   - ACL que depende del estado del dominio
   - Workflows multi-paso con coordinación

2. **Steps**:
   - Crear `domain/` con entity + value objects + ports
   - Mover business logic de Service a UseCases
   - Crear `infrastructure/` con repository + mapper
   - Controller sigue igual (llama Service, Service llama UseCase)
   - Actualizar tests

---

## 📊 Comparison & Decision Matrix

> **See [`.windsurf/skills/ARCHITECTURE-DECISION-GUIDE.md`](../ARCHITECTURE-DECISION-GUIDE.md) for comparison table, decision matrix, and anti-patterns.**

---

## � Examples

### Enterprise CRUD (Hex/DDD + CQRS) - Complete Endpoints

```typescript
// modules/subscriptions/subscriptions.module.ts
@Module({
  imports: [DatabaseModule, CacheModule, EventEmitterModule],
  controllers: [SubscriptionsController],
  providers: [
    // Use Cases
    CreateSubscriptionUseCase,
    UpdateSubscriptionUseCase,
    DeleteSubscriptionUseCase,
    RestoreSubscriptionUseCase,
    BulkDeleteSubscriptionUseCase,
    BulkRestoreSubscriptionUseCase,
    GetSubscriptionUseCase,
    ListSubscriptionsUseCase,
    ExportSubscriptionsUseCase,
    // Infrastructure
    SubscriptionRepository,
    SubscriptionMapper,
    SubscriptionCreatedListener,
  ],
})
export class SubscriptionsModule {}

// modules/subscriptions/subscriptions.controller.ts
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, CaslGuard)
@ApiTags('subscriptions')
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(
    private readonly createUseCase: CreateSubscriptionUseCase,
    private readonly updateUseCase: UpdateSubscriptionUseCase,
    private readonly deleteUseCase: DeleteSubscriptionUseCase,
    private readonly restoreUseCase: RestoreSubscriptionUseCase,
    private readonly bulkDeleteUseCase: BulkDeleteSubscriptionUseCase,
    private readonly bulkRestoreUseCase: BulkRestoreSubscriptionUseCase,
    private readonly getUseCase: GetSubscriptionUseCase,
    private readonly listUseCase: ListSubscriptionsUseCase,
    private readonly exportUseCase: ExportSubscriptionsUseCase,
  ) {}

  @Get()
  @CacheTTL(TTL_SECONDS.MEDIUM)
  @CheckAbilities({ action: Action.Read, subject: 'Subscription' })
  @ApiOkResponse({ type: [SubscriptionResponse] })
  async list(@Query() filter: SubscriptionFilterDto) {
    return this.listUseCase.execute(filter);
  }

  @Get(':id')
  @CacheTTL(TTL_SECONDS.MEDIUM)
  @CheckAbilities({ action: Action.Read, subject: 'Subscription' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: SubscriptionResponse })
  @ApiNotFoundResponse()
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.getUseCase.execute({ id });
  }

  @Post()
  @CheckAbilities({ action: Action.Create, subject: 'Subscription' })
  @ApiCreatedResponse({ type: SubscriptionResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async create(@Body(new ZodValidationPipe(CreateSubscriptionSchema)) dto: CreateSubscriptionDto) {
    return this.createUseCase.execute(dto);
  }

  @Patch(':id')
  @CheckAbilities({ action: Action.Update, subject: 'Subscription' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: SubscriptionResponse })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateSubscriptionSchema)) dto: UpdateSubscriptionDto,
  ) {
    return this.updateUseCase.execute({ id, ...dto });
  }

  @Delete(':id')
  @CheckAbilities({ action: Action.Delete, subject: 'Subscription' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.deleteUseCase.execute({ id });
  }

  @Post(':id/restore')
  @CheckAbilities({ action: Action.Restore, subject: 'Subscription' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: SubscriptionResponse })
  @ApiNotFoundResponse()
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.restoreUseCase.execute({ id });
  }

  @Post('bulk-delete')
  @CheckAbilities({ action: Action.Delete, subject: 'Subscription' })
  @ApiOkResponse({ schema: { type: 'object', properties: { count: { type: 'number' } } } })
  async bulkDelete(@Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto) {
    return this.bulkDeleteUseCase.execute({ ids: dto.ids });
  }

  @Post('bulk-restore')
  @CheckAbilities({ action: Action.Restore, subject: 'Subscription' })
  @ApiOkResponse({ schema: { type: 'object', properties: { count: { type: 'number' } } } })
  async bulkRestore(@Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto) {
    return this.bulkRestoreUseCase.execute({ ids: dto.ids });
  }

  @Get('export')
  @SkipCache()
  @CheckAbilities({ action: Action.Read, subject: 'Subscription' })
  @ApiOkResponse({ content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {} } })
  async export(@Query() filter: SubscriptionFilterDto, @Query('format') format: 'xlsx' | 'csv' | 'pdf') {
    return this.exportUseCase.execute({ filter, format });
  }
}

// modules/subscriptions/application/use-cases/create-subscription.use-case.ts
@Injectable()
export class CreateSubscriptionUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly repository: ISubscriptionRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  @Transactional()
  async execute(dto: CreateSubscriptionDto): Promise<Subscription> {
    const traceId = this.cls.get('traceId');
    this.logger.info('CreateSubscriptionUseCase.execute start', { traceId });

    const subscription = Subscription.create(dto);
    await this.repository.save(subscription);

    await this.audit.log({ action: 'subscriptions.created', resourceId: subscription.id.value }, { strict: true });

    this.eventEmitter.emit('subscription.created', new SubscriptionCreatedEvent(subscription.id.value));

    this.logger.info('CreateSubscriptionUseCase.execute end', { traceId, subscriptionId: subscription.id.value });
    return subscription;
  }
}

// modules/subscriptions/application/use-cases/bulk-delete-subscription.use-case.ts
@Injectable()
export class BulkDeleteSubscriptionUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly repository: ISubscriptionRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  @Transactional()
  async execute({ ids }: { ids: string[] }): Promise<{ count: number }> {
    const traceId = this.cls.get('traceId');
    this.logger.info('BulkDeleteSubscriptionUseCase.execute start', { traceId, idsCount: ids.length });

    const { count } = await this.repository.bulkDelete(ids);

    await this.audit.log({ action: 'subscriptions.bulk_deleted', metadata: { ids, count } }, { strict: true });

    this.eventEmitter.emit('subscription.bulk_deleted', new SubscriptionBulkDeletedEvent(ids, count));

    this.logger.info('BulkDeleteSubscriptionUseCase.execute end', { traceId, count });
    return { count };
  }
}

// modules/subscriptions/application/use-cases/export-subscription.use-case.ts
@Injectable()
export class ExportSubscriptionsUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly repository: ISubscriptionRepository,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    private readonly exportService: ExportService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute({ filter, format }: { filter: SubscriptionFilterDto; format: 'xlsx' | 'csv' | 'pdf' }): Promise<Buffer> {
    const traceId = this.cls.get('traceId');
    this.logger.info('ExportSubscriptionsUseCase.execute start', { traceId, format });

    const subscriptions = await this.repository.findAll(filter);
    const buffer = await this.exportService.generate(subscriptions, format);

    await this.audit.log({ action: 'subscriptions.export', metadata: { format, count: subscriptions.length } });

    this.logger.info('ExportSubscriptionsUseCase.execute end', { traceId, format, count: subscriptions.length });
    return buffer;
  }
}
```

### Bulk Delete / Bulk Restore (Hex/DDD)

Bulk operations in Hex/DDD architecture follow the same pattern as flat CRUD but use UseCases:

```typescript
// Repository interface
interface ISubscriptionRepository {
  bulkDelete(ids: string[]): Promise<{ count: number }>;
  bulkRestore(ids: string[]): Promise<{ count: number }>;
}

// Use Case
@Injectable()
export class BulkDeleteSubscriptionUseCase {
  @Transactional()
  async execute({ ids }: { ids: string[] }): Promise<{ count: number }> {
    const { count } = await this.repository.bulkDelete(ids);
    await this.audit.log({ action: 'subscriptions.bulk_deleted', metadata: { ids, count } }, { strict: true });
    this.eventEmitter.emit('subscription.bulk_deleted', new SubscriptionBulkDeletedEvent(ids, count));
    return { count };
  }
}

// Controller
@Post('bulk-delete')
@CheckAbilities({ action: Action.Delete, subject: 'Subscription' })
async bulkDelete(@Body(new ZodValidationPipe(BulkIdsSchema)) dto: BulkIdsDto) {
  return this.bulkDeleteUseCase.execute({ ids: dto.ids });
}
```

**Rules:**
- One `updateMany`/`deleteMany` per bulk call (never a loop)
- ONE audit row per bulk call (action ends in `_bulk_deleted`/`_bulk_restored`)
- ONE domain event per bulk call (payload includes `ids[]` and `count`)
- POST method (not DELETE with body)
- Max 100 ids per request (OWASP API #4)

---

## �🔗 Related Skills

- **`.windsurf/skills/ARCHITECTURE-SIMPLE/SKILL.md`** — Para lookups/configs simples
- **`.windsurf/skills/ARCHITECTURE-DEFAULT/SKILL.md`** — Para CRUDs con business logic moderada
- **`.windsurf/skills/BACKEND-NEST/SKILL.md`** — Reglas de código, naming, testing, logging, cache, exports
- **`.windsurf/skills/OWASP/SKILL.md`** — Security baseline para APIs
