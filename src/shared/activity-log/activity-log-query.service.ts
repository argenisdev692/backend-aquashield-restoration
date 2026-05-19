import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';
import { PrismaService } from '../database/prisma.service';
import type {
  ActivityLogFilter,
  ActivityLogReadModel,
  PaginatedResult,
} from './activity-log.dto';

type ActivityLogRow = {
  id: string;
  action: string;
  actorId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  traceId: string | null;
  correlationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date;
};

/**
 * Read-only audit queries (for an admin audit UI). Never mutates —
 * the trail is append-only and owned by {@link ActivityLogService}.
 */
@Injectable()
export class ActivityLogQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(ActivityLogQueryService.name);
  }

  async findPaginated(
    filter: ActivityLogFilter,
  ): Promise<PaginatedResult<ActivityLogReadModel>> {
    this.logger.info('ActivityLog query', {
      layer: 'audit',
      action: filter.action,
    });

    const where = {
      ...(filter.actorId ? { actorId: filter.actorId } : {}),
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.resourceId ? { resourceId: filter.resourceId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data: (rows as ActivityLogRow[]).map((r) => this.toReadModel(r)),
      total,
      page: filter.page,
      limit: filter.limit,
    };
  }

  private toReadModel(row: ActivityLogRow): ActivityLogReadModel {
    return {
      id: row.id,
      action: row.action,
      actorId: row.actorId,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      traceId: row.traceId,
      correlationId: row.correlationId,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
