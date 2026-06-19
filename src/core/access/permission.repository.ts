import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import type { PermissionRow, UserPermissionRow } from './actions.enum';

export interface IPermissionRepository {
  getPermissionsForRoles(roleIds: string[]): Promise<PermissionRow[]>;
  getDirectPermissionsForUser(userId: string): Promise<UserPermissionRow[]>;
  getRolesForUser(userId: string): Promise<{ id: string; name: string }[]>;
}

export const PERMISSION_REPOSITORY = Symbol('IPermissionRepository');

type RolePermJoin = {
  conditions: unknown;
  fields: string[];
  permission: { action: string; subject: string };
};

type UserPermJoin = RolePermJoin & { isGranted: boolean };

/**
 * Reads RBAC + ABAC rules from the database. Sole owner of the
 * `role_permissions` / `user_permissions` Prisma access for authorization.
 */
@Injectable()
export class PrismaPermissionRepository implements IPermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPermissionsForRoles(roleIds: string[]): Promise<PermissionRow[]> {
    if (roleIds.length === 0) return [];

    const rows = (await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      select: {
        conditions: true,
        fields: true,
        permission: { select: { action: true, subject: true } },
      },
    })) as RolePermJoin[];

    return rows.map((r) => ({
      action: r.permission.action,
      subject: r.permission.subject,
      conditions: (r.conditions as Record<string, unknown> | null) ?? null,
      fields: r.fields.length > 0 ? r.fields : null,
    }));
  }

  async getDirectPermissionsForUser(
    userId: string,
  ): Promise<UserPermissionRow[]> {
    const rows = (await this.prisma.userPermission.findMany({
      where: { userId },
      select: {
        isGranted: true,
        conditions: true,
        fields: true,
        permission: { select: { action: true, subject: true } },
      },
    })) as UserPermJoin[];

    return rows.map((r) => ({
      action: r.permission.action,
      subject: r.permission.subject,
      conditions: (r.conditions as Record<string, unknown> | null) ?? null,
      fields: r.fields.length > 0 ? r.fields : null,
      isGranted: r.isGranted,
    }));
  }

  async getRolesForUser(
    userId: string,
  ): Promise<{ id: string; name: string }[]> {
    const now = new Date();
    const rows = await this.prisma.userRole.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        role: { deletedAt: null },
      },
      select: {
        role: { select: { id: true, name: true } },
      },
    });
    return rows.map((r) => ({ id: r.role.id, name: r.role.name }));
  }
}
