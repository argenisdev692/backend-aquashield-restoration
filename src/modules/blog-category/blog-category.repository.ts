import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import type { BlogCategory } from './blog-category.entity';
import type {
  BlogCategory as PrismaBlogCategory,
  Prisma,
} from '../../generated/prisma/client';
import {
  buildTrashedWhere,
  type TrashedMode,
} from '../../shared/crud/trashed.util';
import {
  buildDateRangeWhere,
  type DateRange,
} from '../../shared/crud/date-range.util';

@Injectable()
export class BlogCategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(row: PrismaBlogCategory): BlogCategory {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      image: row.image,
      userId: row.userId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  }

  async findAll(
    userId: string,
    limit = 50,
    skip = 0,
    trashed: TrashedMode = 'exclude',
    range?: DateRange,
  ): Promise<{ data: BlogCategory[]; total: number }> {
    const where: Prisma.BlogCategoryWhereInput = {
      ...buildTrashedWhere(trashed),
      ...(range ? buildDateRangeWhere(range) : {}),
      userId,
    };
    const [total, rows] = await Promise.all([
      this.prisma.blogCategory.count({ where }),
      this.prisma.blogCategory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip,
        select: {
          id: true,
          name: true,
          description: true,
          image: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      }),
    ]);
    return {
      data: rows.map((r) => this.mapToEntity(r)),
      total,
    };
  }

  /** Uncapped reader for `/export` — single tenant scope. */
  async findAllForExport(
    userId: string,
    trashed: TrashedMode = 'exclude',
    range?: DateRange,
  ): Promise<BlogCategory[]> {
    const where: Prisma.BlogCategoryWhereInput = {
      ...buildTrashedWhere(trashed),
      ...(range ? buildDateRangeWhere(range) : {}),
      userId,
    };
    const rows = await this.prisma.blogCategory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });
    return rows.map((r) => this.mapToEntity(r));
  }

  /**
   * Tenant-scoped read by id.
   * @param trashed when `true`, soft-deleted categories are returned too
   *                (Laravel `withTrashed()->find()`).
   */
  async findById(
    userId: string,
    id: string,
    trashed: boolean = false,
  ): Promise<BlogCategory | null> {
    const where: Prisma.BlogCategoryWhereInput = trashed
      ? { id, userId }
      : { id, userId, deletedAt: null };
    const row = await this.prisma.blogCategory.findFirst({ where });
    return row ? this.mapToEntity(row) : null;
  }

  async findByName(userId: string, name: string): Promise<BlogCategory | null> {
    const row = await this.prisma.blogCategory.findFirst({
      where: { userId, name, deletedAt: null },
    });
    return row ? this.mapToEntity(row) : null;
  }

  /** Tenant-scoped finder that also sees soft-deleted rows — required for restore. */
  async findByIdWithDeleted(
    userId: string,
    id: string,
  ): Promise<BlogCategory | null> {
    const row = await this.prisma.blogCategory.findFirst({
      where: { id, userId },
    });
    return row ? this.mapToEntity(row) : null;
  }

  async create(data: {
    name?: string | null;
    description?: string | null;
    image?: string | null;
    userId: string;
  }): Promise<BlogCategory> {
    const row = await this.prisma.blogCategory.create({ data });
    return this.mapToEntity(row);
  }

  async update(
    id: string,
    data: Partial<{
      name: string | null;
      description: string | null;
      image: string | null;
    }>,
  ): Promise<BlogCategory> {
    const row = await this.prisma.blogCategory.update({
      where: { id },
      data,
    });
    return this.mapToEntity(row);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.blogCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string): Promise<BlogCategory> {
    const row = await this.prisma.blogCategory.update({
      where: { id },
      data: { deletedAt: null },
    });
    return this.mapToEntity(row);
  }

  async bulkDelete(userId: string, ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.blogCategory.updateMany({
      where: { id: { in: ids }, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { count: result.count };
  }

  async bulkRestore(userId: string, ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.blogCategory.updateMany({
      where: { id: { in: ids }, userId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return { count: result.count };
  }
}
