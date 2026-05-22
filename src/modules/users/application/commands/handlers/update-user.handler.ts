import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { CacheService } from '../../../../../shared/cache/cache.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.interface';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import { User } from '../../../domain/entities/user.aggregate';
import { Email } from '../../../domain/value-objects/email.vo';
import {
  EmailAlreadyExistsException,
  UserNotFoundException,
} from '../../../domain/exceptions/user-domain.exception';
import { UpdateUserCommand } from '../update-user.command';

@CommandHandler(UpdateUserCommand)
export class UpdateUserHandler implements ICommandHandler<UpdateUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly cache: CacheService,
  ) {}

  async execute(command: UpdateUserCommand): Promise<void> {
    const { id } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('UpdateUserHandler start', { traceId, userId: id });

    await this.runWrite(command);

    await this.cache.del(`users-service:user:${id}`);
    await this.cache.delByPattern('users-service:users:list:*');
    if (
      command.dto.roleIds !== undefined ||
      command.dto.permissionIds !== undefined
    ) {
      // CaslAbilityFactory caches per-user rule sets under `casl:ability:{id}`.
      // Drop the snapshot so the next request reflects the new grants.
      await this.cache.del(`casl:ability:${id}`);
    }

    this.logger.info('UpdateUserHandler end', { traceId, userId: id });
  }

  @Transactional()
  private async runWrite(command: UpdateUserCommand): Promise<void> {
    const { id, dto, actorId } = command;

    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new UserNotFoundException(id);
    }

    if (dto.email && dto.email !== user.email.value) {
      const existing = await this.userRepo.findByEmail(dto.email);
      if (existing && existing.id.value !== id) {
        throw new EmailAlreadyExistsException(dto.email);
      }
    }

    const updated = User.reconstitute({
      id: user.id,
      email: dto.email ? Email.create(dto.email) : user.email,
      name: dto.name ?? user.name,
      lastName: dto.lastName !== undefined ? dto.lastName : user.lastName,
      phone: dto.phone !== undefined ? dto.phone : user.phone,
      password: user.password,
      emailVerifiedAt: user.emailVerifiedAt,
      passwordConfirmedAt: user.passwordConfirmedAt,
      createdAt: user.createdAt,
      updatedAt: new Date(),
      deletedAt: user.deletedAt,
    });

    await this.userRepo.save(updated);

    // REPLACE semantics: a present field overwrites the full set; absence
    // leaves it untouched. Both calls happen inside the same tx as the
    // user save and the audit row, so partial failure rolls back.
    if (dto.roleIds !== undefined) {
      await this.userRepo.replaceRoles(id, dto.roleIds, actorId);
    }
    if (dto.permissionIds !== undefined) {
      await this.userRepo.replacePermissions(id, dto.permissionIds, actorId);
    }

    await this.audit.log(
      {
        action: 'users.updated',
        resourceType: 'USER',
        resourceId: id,
        actorId,
        ...(dto.roleIds !== undefined || dto.permissionIds !== undefined
          ? {
              metadata: {
                roleIds: dto.roleIds ?? null,
                permissionIds: dto.permissionIds ?? null,
              },
            }
          : {}),
      },
      { strict: true },
    );
  }
}
