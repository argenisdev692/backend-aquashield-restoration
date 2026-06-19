import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { Prisma } from '../../../../../generated/prisma/client';
import { RetellCallMapper } from '../mappers/retell-call.mapper';
import {
  type IRetellCallRepository,
  type PaginatedResult,
  type RetellCallListFilters,
  type RetellCallReadModel,
  type RetellCallUpsertInput,
  type UpsertCallResult,
} from '../../../domain/repositories/retell-call-repository.interface';
import {
  buildTrashedWhere,
  type TrashedMode,
} from '../../../../../shared/crud/trashed.util';
import {
  buildDateRangeWhere,
  type DateRange,
} from '../../../../../shared/crud/date-range.util';

@Injectable()
export class PrismaRetellCallRepository implements IRetellCallRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toJson(raw: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (raw === null || raw === undefined) return Prisma.JsonNull;
    return raw;
  }

  private writeData(
    input: RetellCallUpsertInput,
  ): Prisma.RetellCallUncheckedCreateInput {
    return {
      callId: input.callId,
      agentId: input.agentId,
      callType: input.callType,
      direction: input.direction,
      fromNumber: input.fromNumber,
      toNumber: input.toNumber,
      callStatus: input.callStatus,
      disconnectionReason: input.disconnectionReason,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMs: input.durationMs,
      userSentiment: input.userSentiment,
      callSummary: input.callSummary,
      transcript: input.transcript,
      recordingUrl: input.recordingUrl,
      raw: this.toJson(input.raw),
    };
  }

  async upsertByCallId(
    input: RetellCallUpsertInput,
  ): Promise<UpsertCallResult> {
    // Partial-unique (`WHERE deleted_at IS NULL`) is not a Prisma `@unique`,
    // so we cannot use `upsert`. Find-then-write, tolerating a concurrent
    // insert (P2002) by falling back to an update.
    const existing = await this.prisma.retellCall.findFirst({
      where: { callId: input.callId, deletedAt: null },
      select: { id: true },
    });

    if (existing) {
      const row = await this.prisma.retellCall.update({
        where: { id: existing.id },
        data: this.writeData(input),
      });
      return { record: RetellCallMapper.toReadModel(row), created: false };
    }

    try {
      const row = await this.prisma.retellCall.create({
        data: this.writeData(input),
      });
      return { record: RetellCallMapper.toReadModel(row), created: true };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Lost a race with a concurrent insert — re-read the now-live row and
        // update it instead (callId is only partially-unique, so update-by-id).
        const winner = await this.prisma.retellCall.findFirst({
          where: { callId: input.callId, deletedAt: null },
          select: { id: true },
        });
        if (winner) {
          const row = await this.prisma.retellCall.update({
            where: { id: winner.id },
            data: this.writeData(input),
          });
          return { record: RetellCallMapper.toReadModel(row), created: false };
        }
      }
      throw err;
    }
  }

  async findById(
    id: string,
    withTrashed = false,
  ): Promise<RetellCallReadModel | null> {
    const where: Prisma.RetellCallWhereInput = withTrashed
      ? { id }
      : { id, deletedAt: null };
    const row = await this.prisma.retellCall.findFirst({ where });
    return row ? RetellCallMapper.toReadModel(row) : null;
  }

  private buildWhere(
    filters: Pick<
      RetellCallListFilters,
      'search' | 'callStatus' | 'userSentiment'
    >,
    mode: TrashedMode,
    range: DateRange,
  ): Prisma.RetellCallWhereInput {
    const where: Prisma.RetellCallWhereInput = {
      ...buildTrashedWhere(mode),
      ...buildDateRangeWhere(range, 'startedAt'),
    };
    if (filters.callStatus) {
      where.callStatus = { contains: filters.callStatus, mode: 'insensitive' };
    }
    if (filters.userSentiment) where.userSentiment = filters.userSentiment;
    if (filters.search) {
      const term = filters.search;
      where.OR = [
        { fromNumber: { contains: term, mode: 'insensitive' } },
        { toNumber: { contains: term, mode: 'insensitive' } },
        { callSummary: { contains: term, mode: 'insensitive' } },
        { transcript: { contains: term, mode: 'insensitive' } },
        { callStatus: { contains: term, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private readonly orderBy: Prisma.RetellCallOrderByWithRelationInput[] = [
    { startedAt: { sort: 'desc', nulls: 'last' } },
    { createdAt: 'desc' },
  ];

  async paginate(
    filters: RetellCallListFilters,
    mode: TrashedMode,
    range: DateRange,
  ): Promise<PaginatedResult<RetellCallReadModel>> {
    const { page, limit } = filters;
    const where = this.buildWhere(filters, mode, range);

    const [data, total] = await Promise.all([
      this.prisma.retellCall.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.orderBy,
      }),
      this.prisma.retellCall.count({ where }),
    ]);

    return {
      data: data.map((row) => RetellCallMapper.toReadModel(row)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findForExport(
    filters: Omit<RetellCallListFilters, 'page' | 'limit'>,
    mode: TrashedMode,
    range: DateRange,
  ): Promise<RetellCallReadModel[]> {
    const rows = await this.prisma.retellCall.findMany({
      where: this.buildWhere(filters, mode, range),
      orderBy: this.orderBy,
    });
    return rows.map((row) => RetellCallMapper.toReadModel(row));
  }

  async markRead(id: string): Promise<boolean> {
    const { count } = await this.prisma.retellCall.updateMany({
      where: { id, deletedAt: null },
      data: { isRead: true },
    });
    return count > 0;
  }

  async softDelete(id: string): Promise<boolean> {
    const { count } = await this.prisma.retellCall.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return count > 0;
  }

  async restore(id: string): Promise<boolean> {
    const { count } = await this.prisma.retellCall.updateMany({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return count > 0;
  }

  async bulkSoftDelete(ids: readonly string[]): Promise<number> {
    const { count } = await this.prisma.retellCall.updateMany({
      where: { id: { in: [...ids] }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return count;
  }

  async bulkRestore(ids: readonly string[]): Promise<number> {
    const { count } = await this.prisma.retellCall.updateMany({
      where: { id: { in: [...ids] }, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return count;
  }
}
