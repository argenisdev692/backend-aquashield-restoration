import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type {
  Permission as PrismaPermission,
  UserPermission as PrismaUserPermission,
} from '../../generated/prisma/client';
import type { UserPermission } from './user-permission.entity';

export interface UpsertUserPermissionInput {
  isGranted: boolean;
  conditions?: Record<string, unknown> | null;
  fields?: string[];
  assignedBy: string;
}

type UserPermissionWithPermission = PrismaUserPermission & {
  permission: PrismaPermission;
};

@Injectable()
export class UserPermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(row: UserPermissionWithPermission): UserPermission {
    return {
      userId: row.userId,
      permissionId: row.permissionId,
      isGranted: row.isGranted,
      conditions: (row.conditions as Record<string, unknown> | null) ?? null,
      fields: row.fields,
      assignedAt: row.assignedAt,
      assignedBy: row.assignedBy,
      permission: {
        id: row.permission.id,
        name: row.permission.name,
        description: row.permission.description,
        module: row.permission.module,
        subject: row.permission.subject,
        action: row.permission.action,
        createdAt: row.permission.createdAt,
        updatedAt: row.permission.updatedAt,
        deletedAt: row.permission.deletedAt,
      },
    };
  }

  async findByUser(userId: string): Promise<UserPermission[]> {
    const rows = await this.prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
      orderBy: [
        { permission: { module: 'asc' } },
        { permission: { name: 'asc' } },
      ],
    });
    return rows.map((r) => this.mapToEntity(r));
  }

  async upsert(
    userId: string,
    permissionId: string,
    input: UpsertUserPermissionInput,
  ): Promise<UserPermission> {
    const conditions = (input.conditions ?? Prisma.DbNull) as
      | Prisma.InputJsonValue
      | typeof Prisma.DbNull;
    const fields = input.fields ?? [];

    const row = await this.prisma.userPermission.upsert({
      where: {
        userId_permissionId: { userId, permissionId },
      },
      create: {
        userId,
        permissionId,
        isGranted: input.isGranted,
        conditions,
        fields,
        assignedBy: input.assignedBy,
      },
      update: {
        isGranted: input.isGranted,
        conditions,
        fields,
        assignedBy: input.assignedBy,
      },
      include: { permission: true },
    });

    return this.mapToEntity(row);
  }

  async remove(userId: string, permissionId: string): Promise<boolean> {
    const result = await this.prisma.userPermission.deleteMany({
      where: { userId, permissionId },
    });
    return result.count > 0;
  }

  async userExists(userId: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { id: userId, deletedAt: null },
    });
    return count > 0;
  }

  async permissionExists(permissionId: string): Promise<boolean> {
    const count = await this.prisma.permission.count({
      where: { id: permissionId, deletedAt: null },
    });
    return count > 0;
  }
}
