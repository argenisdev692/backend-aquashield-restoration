import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { ContactSupport } from '../../../domain/entities/contact-support.aggregate';
import type {
  IContactSupportRepository,
  ListContactSupportFilters,
  ExportContactSupportFilters,
} from '../../../domain/ports/contact-support.repository.interface';
import type {
  ContactSupportReadModel,
  PaginatedContactSupport,
} from '../../../domain/read-models/contact-support.read-model';
import { ContactSupportMapper } from '../mappers/contact-support.mapper';
import { buildTrashedWhere } from '../../../../../shared/crud/trashed.util';
import { buildDateRangeWhere } from '../../../../../shared/crud/date-range.util';
import type { Prisma } from '../../../../../generated/prisma/client';

@Injectable()
export class PrismaContactSupportRepository implements IContactSupportRepository {
  /** Hard cap to prevent OOM when exporting (OWASP API #4 — Unrestricted Resource Consumption). */
  private static readonly EXPORT_MAX_ROWS = 5_000;

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ContactSupport | null> {
    const row = await this.prisma.contactSupport.findFirst({
      where: { id, deletedAt: null },
    });
    return row ? ContactSupportMapper.toDomain(row) : null;
  }

  async findByIdWithDeleted(id: string): Promise<ContactSupport | null> {
    const row = await this.prisma.contactSupport.findUnique({
      where: { id },
    });
    return row ? ContactSupportMapper.toDomain(row) : null;
  }

  async save(entity: ContactSupport): Promise<void> {
    const data = ContactSupportMapper.toPersistence(entity);
    await this.prisma.contactSupport.upsert({
      where: { id: entity.id },
      create: data,
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        message: data.message,
        smsConsent: data.smsConsent,
        readed: data.readed,
        deletedAt: data.deletedAt,
      },
    });
  }

  async findReadModelById(
    id: string,
    trashed: boolean = false,
  ): Promise<ContactSupportReadModel | null> {
    const where: Prisma.ContactSupportWhereInput = trashed
      ? { id }
      : { id, deletedAt: null };
    const row = await this.prisma.contactSupport.findFirst({ where });
    return row ? ContactSupportMapper.toReadModel(row) : null;
  }

  async findMany(
    filters: ListContactSupportFilters,
  ): Promise<PaginatedContactSupport> {
    const where: Prisma.ContactSupportWhereInput = {
      ...buildTrashedWhere(filters.trashed ?? 'exclude'),
      ...(filters.readed === undefined ? {} : { readed: filters.readed }),
      ...(filters.range ? buildDateRangeWhere(filters.range, 'createdAt') : {}),
    };
    const skip = (filters.page - 1) * filters.limit;

    const [rows, total] = await Promise.all([
      this.prisma.contactSupport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      this.prisma.contactSupport.count({ where }),
    ]);

    return {
      data: rows.map((row) => ContactSupportMapper.toReadModel(row)),
      total,
      page: filters.page,
      limit: filters.limit,
    };
  }

  async findAllForExport(
    filters: ExportContactSupportFilters,
  ): Promise<ContactSupportReadModel[]> {
    const where: Prisma.ContactSupportWhereInput = {
      ...buildTrashedWhere(filters.trashed ?? 'exclude'),
      ...(filters.readed === undefined ? {} : { readed: filters.readed }),
      ...(filters.range ? buildDateRangeWhere(filters.range, 'createdAt') : {}),
    };
    const rows = await this.prisma.contactSupport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PrismaContactSupportRepository.EXPORT_MAX_ROWS,
    });
    return rows.map((row) => ContactSupportMapper.toReadModel(row));
  }

  async bulkDelete(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.contactSupport.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { count: result.count };
  }

  async bulkRestore(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.contactSupport.updateMany({
      where: { id: { in: ids }, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return { count: result.count };
  }
}
