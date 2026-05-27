import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { PostMapper } from '../mappers/post.mapper';
import { $Enums, type Prisma } from '../../../../../generated/prisma/client';
import {
  IPostRepository,
  PostFilters,
  PaginatedResult,
  PostReadModel,
} from '../../../domain/repositories/post-repository.interface';
import { Post } from '../../../domain/entities/post.aggregate';
import { buildTrashedWhere } from '../../../../../shared/crud/trashed.util';

@Injectable()
export class PrismaPostRepository implements IPostRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, trashed: boolean = false): Promise<Post | null> {
    const where: Prisma.PostWhereInput = trashed
      ? { id }
      : { id, deletedAt: null };
    const row = await this.prisma.post.findFirst({ where });
    if (!row) return null;
    return PostMapper.toDomain(row);
  }

  async findReadModelById(
    id: string,
    trashed: boolean = false,
  ): Promise<PostReadModel | null> {
    const where: Prisma.PostWhereInput = trashed
      ? { id }
      : { id, deletedAt: null };
    const row = await this.prisma.post.findFirst({
      where,
      include: {
        category: { select: { name: true } },
        user: { select: { name: true } },
      },
    });
    if (!row) return null;
    return PostMapper.toReadModel(row);
  }

  async findIdBySlug(slug: string): Promise<string | null> {
    const row = await this.prisma.post.findFirst({
      where: { postTitleSlug: slug, deletedAt: null },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async findAll(filters: PostFilters): Promise<PaginatedResult<PostReadModel>> {
    const {
      categoryId,
      userId,
      postStatus,
      search,
      page = 1,
      limit = 20,
      trashed = 'exclude',
    } = filters;

    const where: Prisma.PostWhereInput = {
      ...buildTrashedWhere(trashed),
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (userId) {
      where.userId = userId;
    }
    if (postStatus) {
      const parsed =
        $Enums.PostStatus[postStatus as keyof typeof $Enums.PostStatus];
      if (parsed) where.postStatus = parsed;
    }
    if (search) {
      where.OR = [
        { postTitle: { contains: search, mode: 'insensitive' } },
        { postContent: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          postTitle: true,
          postTitleSlug: true,
          postContent: true,
          postExcerpt: true,
          postCoverImage: true,
          metaTitle: true,
          metaDescription: true,
          metaKeywords: true,
          categoryId: true,
          userId: true,
          postStatus: true,
          scheduledAt: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          category: { select: { name: true } },
          user: { select: { name: true } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data: data.map((row) => PostMapper.toReadModel(row)),
      total,
      page,
      limit,
    };
  }

  async findScheduledDue(): Promise<Post[]> {
    const rows = await this.prisma.post.findMany({
      where: {
        postStatus: 'scheduled',
        scheduledAt: { lte: new Date() },
        deletedAt: null,
      },
    });
    return rows.map((row) => PostMapper.toDomain(row));
  }

  async save(post: Post): Promise<void> {
    const data = PostMapper.toPersistence(post);
    await this.prisma.post.upsert({
      where: { id: post.id.value },
      create: data,
      update: data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.post.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string): Promise<void> {
    await this.prisma.post.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async bulkDelete(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.post.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { count: result.count };
  }

  async bulkRestore(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.post.updateMany({
      where: { id: { in: ids }, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return { count: result.count };
  }
}
