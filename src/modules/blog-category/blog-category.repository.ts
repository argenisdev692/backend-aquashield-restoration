import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import type { BlogCategory } from './blog-category.entity';
import type { BlogCategory as PrismaBlogCategory } from '../../generated/prisma/client';

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

  async findAll(): Promise<BlogCategory[]> {
    const rows = await this.prisma.blogCategory.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapToEntity(r));
  }

  async findById(id: string): Promise<BlogCategory | null> {
    const row = await this.prisma.blogCategory.findFirst({
      where: { id, deletedAt: null },
    });
    return row ? this.mapToEntity(row) : null;
  }

  /** Finds a row regardless of soft-delete state — required to restore tombstoned rows. */
  async findByIdWithDeleted(id: string): Promise<BlogCategory | null> {
    const row = await this.prisma.blogCategory.findUnique({ where: { id } });
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
}
