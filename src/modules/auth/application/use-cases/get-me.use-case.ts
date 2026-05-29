import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  STORAGE_PORT,
  type IStoragePort,
} from '../../../../shared/storage/storage.port';
import {
  PERMISSION_REPOSITORY,
  type IPermissionRepository,
} from '../../../../core/access/permission.repository';
import {
  USER_ACCOUNT_REPOSITORY,
  type IUserAccountRepository,
} from '../../domain/ports/user-account.repository.port';
import { UserAccountNotFoundException } from '../../domain/exceptions/auth-domain.exception';
import type { MeResponse } from '../presenters/auth.response';

/**
 * `GET /auth/me`. Returns the auth identity slice + full profile + dedup'd
 * `roles[]` and effective `permissions[]` (RBAC roles ∪ direct grants,
 * minus direct revokes). Token-issuing endpoints do NOT include these
 * lists — clients call this endpoint right after login.
 */
@Injectable()
export class GetMeUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly accounts: IUserAccountRepository,
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissions: IPermissionRepository,
    @Inject(STORAGE_PORT) private readonly storage: IStoragePort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(userId: string): Promise<MeResponse> {
    const account = await this.accounts.findById(userId);
    if (!account) throw new UserAccountNotFoundException();

    // Profile columns live on the `users` row outside the auth aggregate.
    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        lastName: true,
        username: true,
        phone: true,
        dateOfBirth: true,
        address: true,
        address2: true,
        zipCode: true,
        city: true,
        state: true,
        country: true,
        gender: true,
        profilePhotoPath: true,
      },
    });
    if (!profile) throw new UserAccountNotFoundException();

    const now = new Date();
    const roleRows = await this.prisma.userRole.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        role: { deletedAt: null },
      },
      select: {
        role: { select: { id: true, name: true, description: true } },
      },
    });
    const roles = roleRows.map((r) => ({
      id: r.role.id,
      name: r.role.name,
      description: r.role.description,
    }));

    const roleIds = roles.map((r) => r.id);
    const [rolePerms, directPerms] = await Promise.all([
      this.permissions.getPermissionsForRoles(roleIds),
      this.permissions.getDirectPermissionsForUser(userId),
    ]);

    const denied = new Set(
      directPerms
        .filter((p) => !p.isGranted)
        .map((p) => `${p.action}|${p.subject}`),
    );
    const accumulator = new Map<string, { action: string; subject: string }>();
    for (const p of [...rolePerms, ...directPerms.filter((p) => p.isGranted)]) {
      const key = `${p.action}|${p.subject}`;
      if (denied.has(key)) continue;
      if (!accumulator.has(key)) {
        accumulator.set(key, { action: p.action, subject: p.subject });
      }
    }

    return {
      id: account.id,
      name: profile.name,
      lastName: profile.lastName,
      username: profile.username,
      email: account.email.value,
      emailVerifiedAt: account.emailVerifiedAt?.toISOString() ?? null,
      phone: profile.phone,
      dateOfBirth: profile.dateOfBirth
        ? profile.dateOfBirth.toISOString().slice(0, 10)
        : null,
      address: profile.address,
      address2: profile.address2,
      zipCode: profile.zipCode,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      gender: profile.gender,
      profilePhotoUrl: profile.profilePhotoPath
        ? this.storage.publicUrl(profile.profilePhotoPath)
        : null,
      totpEnabled: account.totpEnabled,
      mustChangePassword: account.mustChangePassword,
      roles,
      permissions: Array.from(accumulator.values()),
    };
  }
}
