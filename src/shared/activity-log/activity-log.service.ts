import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../logger/logger.service';
import { PrismaService } from '../database/prisma.service';
import { CLS_KEYS } from '../cls/cls.constants';
import type { Prisma } from '../../generated/prisma/client';
import type {
  IAuditEntry,
  IAuditLogOptions,
  IAuditPort,
} from './audit.port';

const SENSITIVE_KEYS = new Set([
  'password',
  'hashedpassword',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'secret',
  'authorization',
  'cookie',
]);

/**
 * IAuditPort implementation — writes the append-only `activity_logs` row.
 *
 * traceId / correlationId / actor fall back to CLS context so call sites
 * only specify the business-meaningful fields. Sensitive metadata keys are
 * stripped before persistence (defense-in-depth, never log secrets).
 */
@Injectable()
export class ActivityLogService implements IAuditPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(ActivityLogService.name);
  }

  async log(entry: IAuditEntry, options?: IAuditLogOptions): Promise<void> {
    const traceId = this.clsGet(CLS_KEYS.TRACE_ID);
    const correlationId = this.clsGet(CLS_KEYS.CORRELATION_ID);
    const actorId = entry.actorId ?? this.clsGet(CLS_KEYS.USER_ID) ?? null;

    try {
      await this.prisma.activityLog.create({
        data: {
          action: entry.action,
          actorId,
          resourceType: entry.resourceType ?? null,
          resourceId: entry.resourceId ?? null,
          traceId: traceId ?? null,
          correlationId: correlationId ?? null,
          metadata: entry.metadata
            ? (this.sanitize(entry.metadata) as Prisma.InputJsonValue)
            : undefined,
        },
      });
    } catch (err) {
      this.logger.error('Failed to persist audit entry', {
        layer: 'audit',
        action: entry.action,
        error: (err as Error).message,
      });
      // In `strict` mode the caller wraps this call in a transaction and
      // wants the surrounding write to roll back when the audit row cannot
      // be persisted. Default mode preserves legacy fire-and-forget audit.
      if (options?.strict) throw err;
    }
  }

  private clsGet(key: string): string | undefined {
    return this.cls.isActive()
      ? this.cls.get<string | undefined>(key)
      : undefined;
  }

  private sanitize(metadata: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      clean[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value;
    }
    return clean;
  }
}
