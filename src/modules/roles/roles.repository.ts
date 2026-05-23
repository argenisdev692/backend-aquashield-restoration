import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import type { Role, Permission } from './roles.entity';
import { Prisma } from '../../generated/prisma/client';
import type {
  Role as PrismaRole,
  Permission as PrismaPermission,
} from '../../generated/prisma/client';
import {
  buildTrashedWhere,
  type TrashedMode,
} from '../../shared/crud/trashed.util';

/**
 * Input shape for an individual role-permission assignment with optional
 * ABAC `conditions` (interpolated at runtime by `CaslAbilityFactory`) and
 * Field-Level Security `fields` allowlist.
 */
export interface RolePermissionInput {
  permissionId: string;
  conditions?: Record<string, unknown> | null;
  fields?: string[];
}

type RolePermissionWithPermission = {
  conditions: Prisma.JsonValue | null;
  fields: string[];
  permission: PrismaPermission;
};

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(
    row: PrismaRole & { permissions?: RolePermissionWithPermission[] },
  ): Role {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isSystem: row.isSystem,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      permissions: row.permissions
        ? row.permissions.map((rp) => ({
            id: rp.permission.id,
            name: rp.permission.name,
            description: rp.permission.description,
            module: rp.permission.module,
            subject: rp.permission.subject,
            action: rp.permission.action,
            createdAt: rp.permission.createdAt,
            updatedAt: rp.permission.updatedAt,
            deletedAt: rp.permission.deletedAt,
            conditions:
              (rp.conditions as Record<string, unknown> | null) ?? null,
            fields: rp.fields,
          }))
        : [],
    };
  }

  /** Fetch the role's permissions with the pivot's conditions/fields. */
  private async loadPermissions(
    roleId: string,
  ): Promise<RolePermissionWithPermission[]> {
    return this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
  }

  async findById(id: string, trashed = false): Promise<Role | null> {
    const where: Prisma.RoleWhereInput = trashed
      ? { id }
      : { id, deletedAt: null };
    const row = await this.prisma.role.findFirst({
      where,
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
    return row ? this.mapToEntity(row) : null;
  }

  async findByName(name: string): Promise<Role | null> {
    const row = await this.prisma.role.findFirst({
      where: { name, deletedAt: null },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
    return row ? this.mapToEntity(row) : null;
  }

  async findAll(
    limit = 50,
    skip = 0,
    search?: string,
    trashed: TrashedMode = 'exclude',
  ): Promise<Role[]> {
    const where: Prisma.RoleWhereInput = {
      ...buildTrashedWhere(trashed),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.role.findMany({
      where,
      include: {
        permissions: {
          include: { permission: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      skip,
    });

    return rows.map((row) => this.mapToEntity(row));
  }

  async create(data: {
    name: string;
    description?: string | null;
    permissions: RolePermissionInput[];
  }): Promise<Role> {
    const { name, description, permissions } = data;

    const row = await this.prisma.role.create({
      data: {
        name,
        description,
        isSystem: false,
      },
    });

    if (permissions.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({
          roleId: row.id,
          permissionId: p.permissionId,
          conditions: (p.conditions ?? Prisma.DbNull) as Prisma.InputJsonValue,
          fields: p.fields ?? [],
        })),
      });
    }

    const joined = await this.loadPermissions(row.id);
    return this.mapToEntity({ ...row, permissions: joined });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      permissions?: RolePermissionInput[];
    },
  ): Promise<Role> {
    const { name, description, permissions } = data;

    const row = await this.prisma.role.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
      },
    });

    if (permissions !== undefined) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissions.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: id,
            permissionId: p.permissionId,
            conditions: (p.conditions ??
              Prisma.DbNull) as Prisma.InputJsonValue,
            fields: p.fields ?? [],
          })),
        });
      }
    }

    const joined = await this.loadPermissions(row.id);
    return this.mapToEntity({ ...row, permissions: joined });
  }

  /** Upsert a single role↔permission pivot. */
  async attachPermission(
    roleId: string,
    assignment: RolePermissionInput,
  ): Promise<Role> {
    const conditions = (assignment.conditions ?? Prisma.DbNull) as
      | Prisma.InputJsonValue
      | typeof Prisma.DbNull;
    const fields = assignment.fields ?? [];

    await this.prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId: assignment.permissionId,
        },
      },
      create: {
        roleId,
        permissionId: assignment.permissionId,
        conditions,
        fields,
      },
      update: { conditions, fields },
    });

    const role = await this.findById(roleId, true);
    if (!role) {
      throw new InternalServerErrorException(
        `Role ${roleId} disappeared during attachPermission`,
      );
    }
    return role;
  }

  /** Remove a single role↔permission pivot. Returns true if a row was deleted. */
  async detachPermission(
    roleId: string,
    permissionId: string,
  ): Promise<boolean> {
    const result = await this.prisma.rolePermission.deleteMany({
      where: { roleId, permissionId },
    });
    return result.count > 0;
  }

  async permissionExists(permissionId: string): Promise<boolean> {
    const count = await this.prisma.permission.count({
      where: { id: permissionId, deletedAt: null },
    });
    return count > 0;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string): Promise<Role> {
    const row = await this.prisma.role.update({
      where: { id },
      data: { deletedAt: null },
    });
    const joined = await this.loadPermissions(row.id);
    return this.mapToEntity({ ...row, permissions: joined });
  }

  async countSystemInIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return this.prisma.role.count({
      where: { id: { in: ids }, isSystem: true },
    });
  }

  async bulkDelete(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.role.updateMany({
      where: { id: { in: ids }, deletedAt: null, isSystem: false },
      data: { deletedAt: new Date() },
    });
    return { count: result.count };
  }

  async bulkRestore(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.role.updateMany({
      where: { id: { in: ids }, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return { count: result.count };
  }

  async findAllPermissions(): Promise<Permission[]> {
    const rows = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      module: r.module,
      subject: r.subject,
      action: r.action,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    }));
  }
}
