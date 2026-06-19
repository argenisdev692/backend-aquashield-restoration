import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  buildTrashedWhere,
  entityStatus,
  type TrashedMode,
} from '../../shared/crud/trashed.util';
import {
  buildDateRangeWhere,
  type DateRange,
} from '../../shared/crud/date-range.util';
import type {
  AvailabilityRule as PrismaAvailabilityRule,
  AvailabilityException as PrismaAvailabilityException,
  Prisma,
} from '../../generated/prisma/client';

export interface AvailabilityRuleEntity {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityExceptionEntity {
  id: string;
  date: string;
  isAvailable: boolean;
  reason: string | null;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AppointmentTimeEntry {
  inspectionTime: Date | null;
}

interface FindExceptionsParams {
  page: number;
  limit: number;
  range: DateRange;
  isAvailable?: boolean;
  trashed: TrashedMode;
}

@Injectable()
export class AvailabilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────
  //  Mappers
  // ──────────────────────────────

  private mapRule(row: PrismaAvailabilityRule): AvailabilityRuleEntity {
    return {
      id: row.id,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      isAvailable: row.isAvailable,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapException(row: PrismaAvailabilityException): AvailabilityExceptionEntity {
    return {
      id: row.id,
      date: row.date.toISOString().slice(0, 10),
      isAvailable: row.isAvailable,
      reason: row.reason ?? null,
      status: entityStatus(row.deletedAt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  }

  // ──────────────────────────────
  //  Rules
  // ──────────────────────────────

  async findAllRules(): Promise<AvailabilityRuleEntity[]> {
    const rows = await this.prisma.availabilityRule.findMany({
      orderBy: { dayOfWeek: 'asc' },
    });
    return rows.map((r) => this.mapRule(r));
  }

  async findRuleByDay(dayOfWeek: number): Promise<AvailabilityRuleEntity | null> {
    const row = await this.prisma.availabilityRule.findFirst({
      where: { dayOfWeek },
    });
    return row ? this.mapRule(row) : null;
  }

  async upsertRule(
    dayOfWeek: number,
    data: { startTime: string; endTime: string; isAvailable: boolean },
  ): Promise<AvailabilityRuleEntity> {
    const row = await this.prisma.availabilityRule.upsert({
      where: { dayOfWeek },
      create: { dayOfWeek, ...data },
      update: { ...data, updatedAt: new Date() },
    });
    return this.mapRule(row);
  }

  // ──────────────────────────────
  //  Exceptions
  // ──────────────────────────────

  async findExceptions(
    params: FindExceptionsParams,
  ): Promise<{ data: AvailabilityExceptionEntity[]; total: number }> {
    const where: Prisma.AvailabilityExceptionWhereInput = {
      ...buildTrashedWhere(params.trashed),
      ...buildDateRangeWhere(params.range, 'date'),
      ...(params.isAvailable !== undefined ? { isAvailable: params.isAvailable } : {}),
    };

    const skip = (params.page - 1) * params.limit;

    const [total, rows] = await Promise.all([
      this.prisma.availabilityException.count({ where }),
      this.prisma.availabilityException.findMany({
        where,
        orderBy: { date: 'asc' },
        take: params.limit,
        skip,
      }),
    ]);

    return { data: rows.map((r) => this.mapException(r)), total };
  }

  async findAllExceptionsForExport(
    trashed: TrashedMode,
    range: DateRange,
    isAvailable?: boolean,
  ): Promise<AvailabilityExceptionEntity[]> {
    const where: Prisma.AvailabilityExceptionWhereInput = {
      ...buildTrashedWhere(trashed),
      ...buildDateRangeWhere(range, 'date'),
      ...(isAvailable !== undefined ? { isAvailable } : {}),
    };
    const rows = await this.prisma.availabilityException.findMany({
      where,
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => this.mapException(r));
  }

  async findExceptionById(id: string): Promise<AvailabilityExceptionEntity | null> {
    const row = await this.prisma.availabilityException.findFirst({
      where: { id, deletedAt: null },
    });
    return row ? this.mapException(row) : null;
  }

  async findExceptionByDate(date: string): Promise<AvailabilityExceptionEntity | null> {
    const row = await this.prisma.availabilityException.findFirst({
      where: { date: new Date(date), deletedAt: null },
    });
    return row ? this.mapException(row) : null;
  }

  /** Returns active exceptions in a date range, e.g. for a month calendar. */
  async findExceptionsInRange(
    from: Date,
    to: Date,
  ): Promise<AvailabilityExceptionEntity[]> {
    const rows = await this.prisma.availabilityException.findMany({
      where: {
        deletedAt: null,
        date: { gte: from, lte: to },
      },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => this.mapException(r));
  }

  async createException(data: {
    date: string;
    isAvailable: boolean;
    reason?: string;
  }): Promise<AvailabilityExceptionEntity> {
    const row = await this.prisma.availabilityException.create({
      data: {
        date: new Date(data.date),
        isAvailable: data.isAvailable,
        reason: data.reason ?? null,
      },
    });
    return this.mapException(row);
  }

  async updateException(
    id: string,
    data: { date?: string; isAvailable?: boolean; reason?: string | null },
  ): Promise<AvailabilityExceptionEntity> {
    const row = await this.prisma.availabilityException.update({
      where: { id },
      data: {
        ...(data.date !== undefined ? { date: new Date(data.date) } : {}),
        ...(data.isAvailable !== undefined ? { isAvailable: data.isAvailable } : {}),
        ...(data.reason !== undefined ? { reason: data.reason } : {}),
        updatedAt: new Date(),
      },
    });
    return this.mapException(row);
  }

  async findDeletedExceptionById(id: string): Promise<AvailabilityExceptionEntity | null> {
    const row = await this.prisma.availabilityException.findFirst({
      where: { id, deletedAt: { not: null } },
    });
    return row ? this.mapException(row) : null;
  }

  async softDeleteException(id: string): Promise<void> {
    await this.prisma.availabilityException.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restoreException(id: string): Promise<AvailabilityExceptionEntity> {
    const row = await this.prisma.availabilityException.update({
      where: { id },
      data: { deletedAt: null, updatedAt: new Date() },
    });
    return this.mapException(row);
  }

  /** Returns inspectionTime values for appointments on a given date (non-declined). */
  async findAppointmentTimesOnDate(date: string): Promise<AppointmentTimeEntry[]> {
    return this.prisma.appointment.findMany({
      where: {
        deletedAt: null,
        inspectionDate: new Date(date),
        inspectionStatus: { notIn: ['Declined', 'Completed'] },
        inspectionTime: { not: null },
      },
      select: { inspectionTime: true },
    });
  }
}
