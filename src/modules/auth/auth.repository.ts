import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findProfileById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
        permissions: { include: { permission: true } },
      },
    });
  }

  async create(data: any) {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: any) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async setLockedUntil(id: string, lockedUntil: Date) {
    return this.prisma.user.update({ where: { id }, data: { lockedUntil } });
  }

  async clearLockedUntil(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { lockedUntil: null },
    });
  }
}
