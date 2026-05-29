import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import type { Prisma } from '../../../../../generated/prisma/client';
import type {
  ISocialMediaRepository,
  SocialMediaFilters,
  PaginatedSocialMediaGenerations,
} from '../../../domain/ports/social-media-repository.port';
import type {
  SocialMediaGeneration,
  SocialNetwork,
} from '../../../domain/entities/social-media-generation.entity';
import type { SocialMediaGenerationAggregate } from '../../../domain/entities/social-media-generation.aggregate';
import { SocialMediaMapper } from '../mappers/social-media.mapper';
import { buildDateRangeWhere } from '../../../../../shared/crud/date-range.util';

@Injectable()
export class PrismaSocialMediaRepository implements ISocialMediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    aggregate: SocialMediaGenerationAggregate,
  ): Promise<SocialMediaGeneration> {
    const snapshot = aggregate.toSnapshot();
    const data = SocialMediaMapper.toPersistence(snapshot);
    const created = await this.prisma.socialMediaGeneration.create({ data });
    return SocialMediaMapper.toDomain(created);
  }

  async update(
    aggregate: SocialMediaGenerationAggregate,
  ): Promise<SocialMediaGeneration> {
    const snapshot = aggregate.toSnapshot();
    const data = SocialMediaMapper.toUpdate(snapshot);
    const updated = await this.prisma.socialMediaGeneration.update({
      where: { id: snapshot.id },
      data,
    });
    return SocialMediaMapper.toDomain(updated);
  }

  async findById(id: string): Promise<SocialMediaGeneration | null> {
    const record = await this.prisma.socialMediaGeneration.findUnique({
      where: { id },
    });
    return record ? SocialMediaMapper.toDomain(record) : null;
  }

  async findAll(
    filters: SocialMediaFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedSocialMediaGenerations> {
    const where: Prisma.SocialMediaGenerationWhereInput = {
      ...buildDateRangeWhere(filters.dateRange ?? {}, 'createdAt'),
    };

    if (filters.userId) where.userId = filters.userId;
    if (filters.niche) {
      where.niche = { contains: filters.niche, mode: 'insensitive' };
    }
    if (filters.language) where.language = filters.language;

    // Note: network filter is applied in memory after query (JSONB column)
    const skip = (page - 1) * limit;

    const [total, rows] = await Promise.all([
      this.prisma.socialMediaGeneration.count({ where }),
      this.prisma.socialMediaGeneration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    let entities = rows.map((r) => SocialMediaMapper.toDomain(r));

    if (filters.network) {
      const net = filters.network as SocialNetwork;
      entities = entities.filter((e) => !!e.networks[net]);
    }

    return {
      data: entities,
      total,
      page,
      limit,
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.socialMediaGeneration.delete({ where: { id } });
  }

  async bulkDelete(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.socialMediaGeneration.deleteMany({
      where: { id: { in: ids } },
    });
    return { count: result.count };
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.socialMediaGeneration.count({ where: { userId } });
  }
}
