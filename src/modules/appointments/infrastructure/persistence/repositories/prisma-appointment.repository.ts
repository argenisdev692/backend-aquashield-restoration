import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { AppointmentMapper } from '../mappers/appointment.mapper';
import { $Enums, type Prisma } from '../../../../../generated/prisma/client';
import {
  IAppointmentRepository,
  AppointmentFilters,
  PaginatedResult,
  AppointmentReadModel,
} from '../../../domain/repositories/appointment-repository.interface';
import { Appointment } from '../../../domain/entities/appointment.aggregate';
import { buildTrashedWhere } from '../../../../../shared/crud/trashed.util';
import { buildDateRangeWhere } from '../../../../../shared/crud/date-range.util';

@Injectable()
export class PrismaAppointmentRepository implements IAppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    id: string,
    trashed: boolean = false,
  ): Promise<Appointment | null> {
    const where: Prisma.AppointmentWhereInput = trashed
      ? { id }
      : { id, deletedAt: null };
    const row = await this.prisma.appointment.findFirst({ where });
    if (!row) return null;
    return AppointmentMapper.toDomain(row);
  }

  async findReadModelById(
    id: string,
    trashed: boolean = false,
  ): Promise<AppointmentReadModel | null> {
    const where: Prisma.AppointmentWhereInput = trashed
      ? { id }
      : { id, deletedAt: null };
    const row = await this.prisma.appointment.findFirst({ where });
    if (!row) return null;
    return AppointmentMapper.toReadModel(row);
  }

  async findIdByEmail(email: string): Promise<string | null> {
    const row = await this.prisma.appointment.findFirst({
      where: { email, deletedAt: null },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async findAll(
    filters: AppointmentFilters,
  ): Promise<PaginatedResult<AppointmentReadModel>> {
    const {
      statusLead,
      city,
      state,
      country,
      owner,
      page = 1,
      limit = 20,
      trashed = 'exclude',
      range,
    } = filters;

    const where: Prisma.AppointmentWhereInput = {
      ...buildTrashedWhere(trashed),
      ...buildDateRangeWhere(range ?? {}, 'createdAt'),
    };

    if (statusLead) {
      const parsed =
        $Enums.StatusLead[statusLead as keyof typeof $Enums.StatusLead];
      if (parsed) where.statusLead = parsed;
    }
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (state) where.state = { contains: state, mode: 'insensitive' };
    if (country) where.country = { contains: country, mode: 'insensitive' };
    if (owner) where.owner = { contains: owner, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      data: data.map((row) => AppointmentMapper.toReadModel(row)),
      total,
      page,
      limit,
    };
  }

  async save(appointment: Appointment): Promise<void> {
    const data = AppointmentMapper.toPersistence(appointment);
    await this.prisma.appointment.upsert({
      where: { id: appointment.id.value },
      create: data,
      update: data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.appointment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string): Promise<void> {
    await this.prisma.appointment.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async markAsRead(id: string): Promise<void> {
    await this.prisma.appointment.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async bulkDelete(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.appointment.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { count: result.count };
  }

  async bulkRestore(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.appointment.updateMany({
      where: { id: { in: ids }, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return { count: result.count };
  }
}
