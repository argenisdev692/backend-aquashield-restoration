---
description: Shared decision guide for choosing between ARCHITECTURE-SIMPLE, ARCHITECTURE-DEFAULT, and ARCHITECTURE-ENTERPRISE. This is the SINGLE SOURCE OF TRUTH for architectural decisions.
globs: .claude/skills/**
---

# ARCHITECTURE-DECISION-GUIDE — Decision Matrix (2026)

> **Authority**: SINGLE SOURCE OF TRUTH for choosing the right architecture.
> **Purpose**: Eliminates duplication across architecture skill files.
> **Referenced by**: ARCHITECTURE-SIMPLE, ARCHITECTURE-DEFAULT, ARCHITECTURE-ENTERPRISE.

---

## 🧭 Quick Decision Guide

| Signal | Use ARCHITECTURE-SIMPLE | Use ARCHITECTURE-DEFAULT | Use ARCHITECTURE-ENTERPRISE |
|---|---|---|---|
| Business rules | None / trivial validations | Moderate logic, exports, cache, audit | State machines, invariants, multi-step workflows |
| Events | No | No (optional EventEmitter2) | Yes (domain events with real listeners) |
| Cross-context | No | No | Yes (ACL adapters) |
| Value Objects | No | No | Yes |
| CQRS bus | No — direct Service call | No — direct Service call | Yes (`CommandBus`/`QueryBus`) |
| Files per module | 8-10 | 10-12 | ~15 |
| Example | `categories`, `tags`, `statuses` | `users`, `projects`, `appointments` | `auth`, `billing`, `subscriptions` |

---

## 📊 Comparison

| Aspecto | Simple | Default | Enterprise |
|---------|--------|---------|------------|
| Archivos por módulo | 8-10 | 10-12 | ~15 |
| CQRS | ❌ Nunca | ❌ Nunca | ✅ Siempre |
| Domain layer | ❌ Nunca | ❌ Nunca | ✅ Siempre |
| Ports en módulos | ❌ Nunca | ❌ Nunca | ✅ Siempre |
| Tiempo para crear CRUD | ~10min | ~20min | ~2h |
| Overengineering | Bajo | Bajo | Medio |
| Mantenibilidad | Simple | Simple | Compleja |

---

## 🎯 Decision Matrix

### Usa ARCHITECTURE-SIMPLE cuando:
- CRUD simple (≤5 campos)
- Sin reglas de negocio complejas
- Sin domain events
- Sin exports
- Sin cache/audit

### Usa ARCHITECTURE-DEFAULT cuando:
- CRUD con business logic moderada
- Validaciones complejas pero sin invariantes
- Requiere cache, audit, exports
- Bulk operations
- Soft delete
- >5 campos

### Usa ARCHITECTURE-ENTERPRISE cuando:
- Invariantes complejas (state machines, cálculos cross-entity)
- Domain events requeridos por otros bounded contexts
- ACL complejo que depende del estado del dominio
- Workflows multi-paso con coordinación
- **CQRS obligatorio**: CommandBus/QueryBus para todos los casos de uso

---

## 🚫 Anti-patterns (Apply to ALL Architectures)

```
❌ Domain layer sin invariantes reales (overengineering)
❌ Ports/adapters para servicios que no varían
❌ CQRS sin necesidad real
❌ CommandBus/QueryBus para CRUDs simples
❌ Domain events antes de repository.save()
❌ Business logic en Controller
❌ Llamadas directas a Prisma desde Controller
❌ Interfaces en shared/database/cache/logger
❌ shared/ importa de modules/
❌ any types, @ts-ignore
❌ class-validator/class-transformer
❌ console.log (usar LoggerService)
❌ Hardcoded secrets
❌ Circuit breaker en domain/DB calls
❌ Bulk operations como N single calls
```

---

## 📑 Standard Endpoints (per-tier applicability)

Endpoints below are the canonical surface; **applicability depends on the tier the module opts into**. Implementing an endpoint pulls in its enforcement rules (audit, cache invalidation, CASL action) — do not ship a route without them.

| Method | Route | SIMPLE | DEFAULT | ENTERPRISE | Notes |
|--------|-------|--------|---------|------------|-------|
| GET | `/{module}` | ✅ required | ✅ required | ✅ required | List with pagination & filters |
| GET | `/{module}/:id` | ✅ required | ✅ required | ✅ required | Single by id |
| POST | `/{module}` | ✅ required | ✅ required | ✅ required | Create |
| PATCH | `/{module}/:id` | ✅ required | ✅ required | ✅ required | Update |
| DELETE | `/{module}/:id` | ✅ required | ✅ required | ✅ required | Soft (if `deletedAt`) or hard |
| POST | `/{module}/:id/restore` | ⛔ N/A | ✅ when soft-delete | ✅ when soft-delete | Restore soft-deleted |
| POST | `/{module}/bulk-delete` | ⛔ N/A | ✅ when list has multi-select | ✅ when list has multi-select | Single `updateMany`/`deleteMany` |
| POST | `/{module}/bulk-restore` | ⛔ N/A | ✅ when soft-delete + bulk | ✅ when soft-delete + bulk | `Action.Restore` |
| GET | `/{module}/export` | ⛔ N/A | ✅ when admin UI needs it | ✅ when admin UI needs it | XLSX / PDF / CSV |

**Rules:**
- SIMPLE modules SHIP ONLY the five base endpoints (list / get / create / update / delete). Adding restore / bulk / export is an upgrade trigger to DEFAULT.
- Export route registered BEFORE `GET /:id` to avoid route shadowing.
- Bulk operations use POST (not DELETE with body), capped at `max(100)` ids (OWASP API #4).
- Soft-delete endpoints only when the entity has a `deletedAt` column. Pick ONE strategy per module (soft OR hard) — never mix.
- All endpoints use CASL guards with the appropriate `Action`. `Action.Restore` is distinct from `Action.Delete`.
- All write endpoints audit logged with `{module}.{verb}` action (DEFAULT and ENTERPRISE); SIMPLE modules do not audit by definition.

---

## �🟡 Shared Layer Rules (Apply to ALL Architectures)

```
✅ shared/external/ usa Port + Adapter pattern
✅ shared/database/cache/logger NO interfaces (concretos)
✅ shared/utils funciones puras
✅ shared/config valida env vars con Zod
✅ shared/ NEVER importa de modules/

❌ Interfaces en shared/database/cache/logger
❌ shared/ importa de modules/
❌ Lógica de negocio en shared/
```

### Root Project Tree (DEFAULT + ENTERPRISE — identical)

```
src/
├── main.ts                         # Bootstrap: HTTP + WebSocket
├── app.module.ts                   # Root module: imports CoreModule, SharedModule, feature modules
│
├── core/                           # 🟢 Cross-cutting concerns — NO business logic
│   ├── guards/
│   │   ├── jwt-auth.guard.ts             # Level 1 — Verifies JWT on HTTP requests
│   │   └── roles.guard.ts                # Level 2 — Role-based access
│   ├── filters/
│   │   └── global-exception.filter.ts    # HTTP errors → RFC 7807 Problem Details
│   ├── interceptors/
│   │   ├── logging.interceptor.ts        # Logs every HTTP request/response with traceId
│   │   └── timeout.interceptor.ts        # Configurable timeout per route
│   ├── pipes/
│   │   └── zod-validation.pipe.ts        # Validates all DTOs with Zod v4
│   ├── decorators/
│   │   ├── current-user.decorator.ts     # @CurrentUser() extracts JWT claims
│   │   └── roles.decorator.ts            # @Roles('admin', 'superadmin')
│   └── health/
│       └── health.controller.ts          # GET /health — @nestjs/terminus checks all deps
│
├── shared/                         # 🟡 Shared infrastructure (full tree below)
│
├── logger/                         # 🟢 Logger — sibling of shared (Pino wrapper)
│   ├── logger.service.ts             # Pino wrapper: log/info/warn/error/debug
│   ├── pino.config.ts                # Pino options: pretty dev, JSON prod, redact list
│   ├── log-redact.constants.ts       # Redact: password, token, secret...
│   ├── logger.context.ts             # Logger context utilities
│   └── logger.module.ts              # Global — auto-imported by AppModule
│
└── modules/                        # 🔴 Bounded Contexts
    ├── auth/                          ← Hex/DDD (jwt, refresh, roles)
    ├── users/                         ← DEFAULT
    ├── projects/                      ← DEFAULT or ENTERPRISE
    ├── subscriptions/                 ← ENTERPRISE (payments, jobs, events)
    ├── billing/                       ← ENTERPRISE
    └── {feature}/                     ← DEFAULT by default
```

### Shared Infrastructure Tree

The `src/shared/` directory contains cross-cutting concerns importable by any module. It NEVER imports from `modules/` (prevents circular dependencies).

```
shared/
├── activity-log/
│   ├── activity-log.module.ts        # Provides ActivityLogService as IAuditPort binding
│   ├── activity-log.service.ts       # IAuditPort implementation — inserts into activity_logs
│   ├── activity-log.prisma           # Prisma model `ActivityLog` (APPEND-ONLY)
│   ├── activity-log-query.service.ts # Read-only queries for audit UI
│   └── activity-log.dto.ts           # AuditLogEntry type definition
│
├── cache/
│   ├── cache.service.ts              # Redis facade: get/set/del/delByPattern
│   ├── cache-ttl.constants.ts        # TTL_SECONDS: SHORT | MEDIUM | LONG
│   ├── cache.port.ts                 # ICachePort + CACHE_PORT symbol
│   ├── redis.provider.ts             # Redis provider configuration
│   └── cache.module.ts               # @Global() — ioredis-backed
│
├── cls/
│   ├── cls.module.ts                 # nestjs-cls configuration
│   └── cls-transaction-manager.adapter.ts
│
├── crud/
│   └── trashed.util.ts               # Soft-delete visibility utilities (withTrashed/onlyTrashed)
│
├── crypto/
│   └── crypto.util.ts                # Pure functions: hashing, random strings
│
├── database/
│   ├── prisma.service.ts             # PrismaClient wrapper (output: src/generated/prisma)
│   ├── database.module.ts            # @Global() — registers PrismaService
│   ├── transaction-manager.port.ts   # ITransactionManager + TRANSACTION_MANAGER symbol
│   └── cls-transaction-manager.adapter.ts
│
├── export/
│   └── export.service.ts            # Export service for Excel/PDF generation
│
├── external/                         # Outbound integrations — Port + Adapter pattern
│   ├── ai/                           # ← varía: OpenAI / Anthropic / Gemini
│   │   ├── ai.port.ts                # IAiPort + AI_PORT symbol
│   │   ├── openai.adapter.ts         # implements IAiPort
│   │   └── ai.module.ts              # env var AI_PROVIDER decides binding
│   │
│   └── resilience/
│       ├── circuit-breaker.service.ts    # Cockatiel: CB + retry + timeout
│       ├── circuit-breaker.decorator.ts  # @CircuitBreaker('nombre')
│       └── resilience.module.ts
│
├── image/
│   └── image.service.ts             # Image processing service
│
├── messaging/
│   ├── bullmq.module.ts             # @nestjs/bullmq registration
│   └── queues/                       # @Processor() classes per queue
│
├── phone/
│   └── phone.util.ts                # Phone number validation utilities
│
├── security/
│   └── security.service.ts           # Security utilities (password hashing, etc.)
│
├── storage/
│   ├── storage.port.ts               # IStoragePort + STORAGE_PORT symbol
│   ├── r2.adapter.ts                 # implements IStoragePort
│   └── storage.module.ts
│
└── websockets/
    └── websockets.module.ts           # WebSocket configuration
```

> `shared/external/` may host additional integration subfolders besides `ai/` and `resilience/` — e.g. `fastapi/` for an internal Python service (`IFastapiClient` + adapter) — following the same Port + Adapter pattern. Only add a subfolder when the integration is consumed by ≥2 modules.

> `logger/` lives as a SIBLING of `shared/`, not inside it (it has its own Pino transport setup). See ARCHITECTURE-DEFAULT/ENTERPRISE for the full root tree.

---

## 🔗 Related Skills

- **`.claude/skills/ARCHITECTURE-SIMPLE/SKILL.md`** — Para lookups/configs simples
- **`.claude/skills/ARCHITECTURE-DEFAULT/SKILL.md`** — Para CRUDs con business logic moderada
- **`.claude/skills/ARCHITECTURE-ENTERPRISE/SKILL.md`** — Para bounded contexts complejos
- **`.claude/skills/BACKEND-NEST/SKILL.md`** — Reglas de código, naming, testing, logging, cache, exports
- **`.claude/skills/OWASP/SKILL.md`** — Security baseline para APIs
