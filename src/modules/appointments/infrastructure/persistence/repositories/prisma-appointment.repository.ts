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

@Injectable()
export class PrismaAppointmentRepository implements IAppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Appointment | null> {
    const row = await this.prisma.appointment.findUnique({ where: { id } });
    if (!row) return null;
    return AppointmentMapper.toDomain(row);
  }

  async findReadModelById(id: string): Promise<AppointmentReadModel | null> {
    const row = await this.prisma.appointment.findUnique({ where: { id } });
    if (!row) return null;
    return AppointmentMapper.toReadModel(row);
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
    } = filters;

    const where: Prisma.AppointmentWhereInput = {
      deletedAt: null,
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
}
