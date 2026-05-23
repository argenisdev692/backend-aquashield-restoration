import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../logger/logger.service';
import { CacheService } from '../../shared/cache/cache.service';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../shared/activity-log/audit.port';
import {
  TRANSACTION_MANAGER,
  type ITransactionManager,
} from '../../shared/database/transaction-manager.port';
import {
  UserPermissionsRepository,
  type UpsertUserPermissionInput,
} from './user-permissions.repository';
import type { UserPermission } from './user-permission.entity';
import type { UpsertUserPermissionDto } from './dto/upsert-user-permission.dto';

@Injectable()
export class UserPermissionsService {
  constructor(
    private readonly repository: UserPermissionsRepository,
    private readonly cache: CacheService,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    @Inject(AUDIT_PORT) private readonly audit: IAuditPort,
    @Inject(TRANSACTION_MANAGER) private readonly tx: ITransactionManager,
  ) {
    this.logger.setContext(UserPermissionsService.name);
  }

  async listForUser(userId: string): Promise<UserPermission[]> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('UserPermissionsService.listForUser', { traceId, userId });

    await this.assertUserExists(userId);
    return this.repository.findByUser(userId);
  }

  async upsert(
    userId: string,
    dto: UpsertUserPermissionDto,
    actorId: string,
  ): Promise<UserPermission> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('UserPermissionsService.upsert start', {
      traceId,
      userId,
      permissionId: dto.permissionId,
      isGranted: dto.isGranted,
      actorId,
    });

    await this.assertUserExists(userId);
    await this.assertPermissionExists(dto.permissionId);

    const input: UpsertUserPermissionInput = {
      isGranted: dto.isGranted,
      conditions: dto.conditions ?? null,
      fields: dto.fields ?? [],
      assignedBy: actorId,
    };

    const result = await this.tx.runInTx(async () => {
      const row = await this.repository.upsert(userId, dto.permissionId, input);
      await this.audit.log(
        {
          action: dto.isGranted
            ? 'users.permission_granted'
            : 'users.permission_denied',
          actorId,
          resourceType: 'USER',
          resourceId: userId,
          metadata: {
            permissionId: dto.permissionId,
            isGranted: dto.isGranted,
            hasConditions: input.conditions !== null,
            fieldCount: input.fields?.length ?? 0,
          },
        },
        { strict: true },
      );
      return row;
    });

    await this.invalidateCacheForUser(userId);
    this.logger.info('UserPermissionsService.upsert end', {
      traceId,
      userId,
      permissionId: dto.permissionId,
    });
    return result;
  }

  async remove(
    userId: string,
    permissionId: string,
    actorId: string,
  ): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('UserPermissionsService.remove start', {
      traceId,
      userId,
      permissionId,
      actorId,
    });

    await this.assertUserExists(userId);

    await this.tx.runInTx(async () => {
      const removed = await this.repository.remove(userId, permissionId);
      if (!removed) {
        throw new NotFoundException(
          'Permission override is not attached to this user',
        );
      }
      await this.audit.log(
        {
          action: 'users.permission_override_removed',
          actorId,
          resourceType: 'USER',
          resourceId: userId,
          metadata: { permissionId },
        },
        { strict: true },
      );
    });

    await this.invalidateCacheForUser(userId);
    this.logger.info('UserPermissionsService.remove end', {
      traceId,
      userId,
      permissionId,
    });
  }

  private async assertUserExists(userId: string): Promise<void> {
    const exists = await this.repository.userExists(userId);
    if (!exists) throw new NotFoundException('User not found');
  }

  private async assertPermissionExists(permissionId: string): Promise<void> {
    const exists = await this.repository.permissionExists(permissionId);
    if (!exists) throw new NotFoundException('Permission not found');
  }

  /**
   * Targeted cache invalidation — only buckets that depend on this user's
   * resolved ability set. Avoids the `casl:ability:*` wildcard used by the
   * roles module (which would nuke every user's cached ruleset on a single
   * per-user override change).
   */
  private async invalidateCacheForUser(userId: string): Promise<void> {
    await this.cache.del(`casl:ability:${userId}`);
    await this.cache.delByPattern('http:*:/auth/me*');
    await this.cache.delByPattern('http:*:/users*');
  }
}
