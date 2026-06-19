import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import type { ActivityLog } from './activitylog.entity';
import type { ActivityLogFilterDto } from './dto/activitylog-filter.dto';
import {
  buildDateRangeWhere,
  type DateRange,
} from '../../shared/crud/date-range.util';
import type {
  ActivityLog as PrismaActivityLog,
  Prisma,
} from '../../generated/prisma/client';

@Injectable()
export class ActivityLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ActivityLog | null> {
    const row = await this.prisma.activityLog.findUnique({ where: { id } });
    return row ? this.mapToEntity(row) : null;
  }

  async findAll(
    filter: ActivityLogFilterDto,
    range: DateRange,
  ): Promise<{ data: ActivityLog[]; total: number }> {
    const where: Prisma.ActivityLogWhereInput = {
      ...(filter.actorId ? { actorId: filter.actorId } : {}),
      ...(filter.action
        ? { action: { contains: filter.action, mode: 'insensitive' } }
        : {}),
      ...(filter.resourceId ? { resourceId: filter.resourceId } : {}),
      ...buildDateRangeWhere(range, 'createdAt'),
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
      data: rows.map((r) => this.mapToEntity(r)),
      total,
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.activityLog.delete({ where: { id } });
  }

  private mapToEntity(row: PrismaActivityLog): ActivityLog {
    return {
      id: row.id,
      action: row.action,
      actorId: row.actorId ?? null,
      resourceType: row.resourceType ?? null,
      resourceId: row.resourceId ?? null,
      traceId: row.traceId ?? null,
      correlationId: row.correlationId ?? null,
      ipAddress: row.ipAddress ?? null,
      userAgent: row.userAgent ?? null,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
