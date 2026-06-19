import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import {
  Prisma,
  CampaignGenerationStatus,
} from '../../../../../generated/prisma/client';
import type { ICampaignGenerationRepository } from '../../../domain/ports/campaign-generation.repository.port';
import { CampaignGeneration } from '../../../domain/entities/campaign-generation.aggregate';
import { CampaignGenerationMapper } from '../mappers/campaign-generation.mapper';
import { StageExportResult } from '../../../domain/value-objects/stage-export-result.vo';
import {
  buildDateRangeWhere,
  type DateRange,
} from '../../../../../shared/crud/date-range.util';

/**
 * Prisma implementation of the CampaignGeneration repository.
 * Handles both the main aggregate and the child stage export rows.
 */
@Injectable()
export class PrismaCampaignGenerationRepository implements ICampaignGenerationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(aggregate: CampaignGeneration): Promise<string | undefined> {
    const data = CampaignGenerationMapper.toPersistence(aggregate);

    if (aggregate.id) {
      // Update existing — strip id from data (Prisma doesn't allow id in update)
      const { id: _id, ...updateData } = data;
      await this.prisma.campaignGeneration.update({
        where: { id: aggregate.id },
        data: {
          ...updateData,
          updatedAt: aggregate.updatedAt,
        },
      });

      // Upsert stage exports
      for (const result of aggregate.stageResults) {
        await this.prisma.campaignStageExport.upsert({
          where: {
            generationId_stage: {
              generationId: aggregate.id,
              stage: result.stage,
            },
          },
          create: {
            generationId: aggregate.id,
            ...result.toPrisma(),
          },
          update: result.toPrisma(),
        });
      }
    } else {
      // Create new
      const created = await this.prisma.campaignGeneration.create({
        data,
      });

      // Return the generated ID so the caller can attach it without reflection hacks.
      // We still create the initial stage placeholder rows here.
      for (const stage of aggregate.stages) {
        await this.prisma.campaignStageExport.create({
          data: {
            generationId: created.id,
            stage,
          },
        });
      }

      // The caller (handler) is responsible for setting the ID on the in-memory aggregate
      // if it needs it afterwards. We return the id explicitly.
      return created.id; // we will adjust the port signature in a follow-up edit
    }
  }

  async findById(
    id: string,
    withTrashed = false,
  ): Promise<CampaignGeneration | null> {
    const where: Prisma.CampaignGenerationWhereInput = { id };
    if (!withTrashed) {
      where.deletedAt = null;
    }

    const row = await this.prisma.campaignGeneration.findFirst({
      where,
      include: {
        stageExports: true,
      },
    });

    if (!row) return null;

    return CampaignGenerationMapper.toDomain(row);
  }

  async findByUserId(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      withTrashed?: boolean;
      dateRange?: DateRange;
    } = {},
  ): Promise<{ data: CampaignGeneration[]; total: number }> {
    const { limit = 20, offset = 0, withTrashed = false, dateRange } = options;

    const where: Prisma.CampaignGenerationWhereInput = {
      userId,
      ...buildDateRangeWhere(dateRange ?? {}, 'createdAt'),
    };
    if (!withTrashed) {
      where.deletedAt = null;
    }

    const [total, rows] = await Promise.all([
      this.prisma.campaignGeneration.count({ where }),
      this.prisma.campaignGeneration.findMany({
        where,
        include: {
          stageExports: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      data: rows.map(
        (r: Parameters<typeof CampaignGenerationMapper.toDomain>[0]) =>
          CampaignGenerationMapper.toDomain(r),
      ),
      total,
    };
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.campaignGeneration.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async hardDelete(id: string): Promise<void> {
    // First delete child stage exports
    await this.prisma.campaignStageExport.deleteMany({
      where: { generationId: id },
    });
    // Then delete the main record
    await this.prisma.campaignGeneration.delete({
      where: { id },
    });
  }

  async bulkHardDelete(ids: string[]): Promise<number> {
    // Delete child stage exports first
    await this.prisma.campaignStageExport.deleteMany({
      where: { generationId: { in: ids } },
    });
    // Then delete main records
    const result = await this.prisma.campaignGeneration.deleteMany({
      where: { id: { in: ids } },
    });
    return result.count;
  }

  async findForExport(
    userId: string,
    filters: { status?: string; dateRange?: DateRange } = {},
  ): Promise<
    Array<{
      id: string;
      userId: string;
      companyNameSnapshot: string;
      niche: string;
      location: string;
      phone: string;
      status: string;
      stages: string[];
      format: string;
      durationSeconds: number;
      language: string;
      generateImages: boolean;
      createdAt: Date;
      updatedAt: Date;
      errorMessage: string | null;
    }>
  > {
    const where: Prisma.CampaignGenerationWhereInput = {
      userId,
      deletedAt: null,
      ...buildDateRangeWhere(filters.dateRange ?? {}, 'createdAt'),
    };

    if (filters.status) {
      where.status = filters.status as CampaignGenerationStatus;
    }

    const rows = await this.prisma.campaignGeneration.findMany({
      where,
      select: {
        id: true,
        userId: true,
        companyNameSnapshot: true,
        niche: true,
        location: true,
        phone: true,
        status: true,
        stages: true,
        format: true,
        durationSeconds: true,
        language: true,
        generateImages: true,
        createdAt: true,
        updatedAt: true,
        errorMessage: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      companyNameSnapshot: r.companyNameSnapshot,
      niche: r.niche,
      location: r.location,
      phone: r.phone,
      status: r.status,
      stages: (r.stages as string[]) ?? [],
      format: r.format,
      durationSeconds: r.durationSeconds,
      language: r.language,
      generateImages: r.generateImages,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      errorMessage: r.errorMessage,
    }));
  }
}
