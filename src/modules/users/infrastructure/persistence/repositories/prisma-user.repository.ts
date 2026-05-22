import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { LoggerService } from '../../../../../logger/logger.service';
import { Prisma } from '../../../../../generated/prisma/client';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import type { User } from '../../../domain/entities/user.aggregate';
import type { UserAccess } from '../../../domain/projections/user-access.projection';
import { UserMapper } from '../mappers/user.mapper';
import {
  buildTrashedWhere,
  type TrashedMode,
} from '../../../../../shared/crud/trashed.util';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async findById(id: string, trashed: boolean = false): Promise<User | null> {
    // Without `trashed=true` we replicate Laravel `Model::find()` —
    // suspended rows are invisible. With it, we replicate `withTrashed()`.
    const where: Prisma.UserWhereInput = trashed ? { id } : { id, deletedAt: null };
    const row = await this.prisma.user.findFirst({ where });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findAll(params: {
    skip: number;
    take: number;
    search?: string;
    trashed?: TrashedMode;
  }): Promise<{ users: User[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      ...buildTrashedWhere(params.trashed ?? 'exclude'),
    };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: rows.map((row) => UserMapper.toDomain(row)),
      total,
    };
  }

  async create(user: User): Promise<User> {
    // `id` is intentionally omitted so the DB default (uuid_generate_v7()) applies.
    const { name, lastName, email, phone, password } =
      UserMapper.toPersistence(user);
    const row = await this.prisma.user.create({
      data: { name, lastName, email, phone, password },
    });
    return UserMapper.toDomain(row);
  }

  async save(user: User): Promise<void> {
    const data = UserMapper.toPersistence(user);
    await this.prisma.user.update({
      where: { id: user.id.value },
      data: {
        name: data.name,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
      },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async existsByEmail(email: string, excludeId?: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: {
        email: email.toLowerCase(),
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return count > 0;
  }

  async existsByUsername(
    username: string,
    excludeId?: string,
  ): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: {
        username: username.toLowerCase(),
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return count > 0;
  }

  async bulkDelete(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.user.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { count: result.count };
  }

  async bulkRestore(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.user.updateMany({
      where: { id: { in: ids }, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return { count: result.count };
  }

  async replaceRoles(
    userId: string,
    roleIds: string[],
    assignedBy: string,
  ): Promise<void> {
    // Caller wraps this in a transaction; `@nestjs-cls/transactional`
    // proxies PrismaService onto the active tx automatically.
    await this.prisma.userRole.deleteMany({ where: { userId } });
    if (roleIds.length === 0) return;
    await this.prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId, roleId, assignedBy })),
      skipDuplicates: true,
    });
  }

  async replacePermissions(
    userId: string,
    permissionIds: string[],
    assignedBy: string,
  ): Promise<void> {
    // Only touches grant rows (`is_granted=true`). Explicit DENY rows are
    // managed by a future dedicated endpoint and must survive a regular
    // replace.
    await this.prisma.userPermission.deleteMany({
      where: { userId, isGranted: true },
    });
    if (permissionIds.length === 0) return;
    await this.prisma.userPermission.createMany({
      data: permissionIds.map((permissionId) => ({
        userId,
        permissionId,
        isGranted: true,
        assignedBy,
      })),
      skipDuplicates: true,
    });
  }

  async findAccessByUserId(userId: string): Promise<UserAccess> {
    const map = await this.findAccessByUserIds([userId]);
    return map.get(userId) ?? { roles: [], permissions: [] };
  }

  async findAccessByUserIds(
    userIds: string[],
  ): Promise<Map<string, UserAccess>> {
    if (userIds.length === 0) return new Map();

    // 1 SQL — assigned roles + each role's permission rows
    const userRoleRows = await this.prisma.userRole.findMany({
      where: { userId: { in: userIds } },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            permissions: {
              select: {
                permission: { select: { action: true, subject: true } },
              },
            },
          },
        },
      },
    });

    // 1 SQL — direct grants only (explicit DENY rows ignored for read projection)
    const userDirectPermRows = await this.prisma.userPermission.findMany({
      where: { userId: { in: userIds }, isGranted: true },
      select: {
        userId: true,
        permission: { select: { action: true, subject: true } },
      },
    });

    const access = new Map<string, UserAccess>();
    const dedupeKey = (action: string, subject: string): string =>
      `${action}:${subject}`;

    for (const userId of userIds) {
      access.set(userId, {
        roles: [],
        permissions: [],
      });
    }

    // Bucket roles + role-inherited permissions
    const permIndex = new Map<string, Map<string, { action: string; subject: string }>>();
    for (const userId of userIds) {
      permIndex.set(userId, new Map());
    }

    for (const row of userRoleRows) {
      const bucket = access.get(row.userId);
      const perms = permIndex.get(row.userId);
      if (!bucket || !perms) continue;
      bucket.roles.push({ id: row.role.id, name: row.role.name });
      for (const rp of row.role.permissions) {
        const { action, subject } = rp.permission;
        perms.set(dedupeKey(action, subject), { action, subject });
      }
    }

    // Merge direct grants (deduplicated against role-inherited)
    for (const row of userDirectPermRows) {
      const perms = permIndex.get(row.userId);
      if (!perms) continue;
      const { action, subject } = row.permission;
      perms.set(dedupeKey(action, subject), { action, subject });
    }

    // Materialize the flat permission arrays
    for (const userId of userIds) {
      const bucket = access.get(userId);
      const perms = permIndex.get(userId);
      if (!bucket || !perms) continue;
      bucket.permissions = [...perms.values()];
    }

    return access;
  }
}
