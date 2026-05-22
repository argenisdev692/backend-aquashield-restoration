import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { CacheService } from '../../../../../shared/cache/cache.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.interface';
import type { IPasswordSetupRepository } from '../../../domain/repositories/password-setup.repository.interface';
import { PASSWORD_SETUP_REPOSITORY } from '../../../domain/repositories/password-setup.repository.interface';
import type { IEmailPort } from '../../../domain/ports/outbound/email.port';
import { EMAIL_PORT } from '../../../domain/ports/outbound/email.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import { User } from '../../../domain/entities/user.aggregate';
import { Email } from '../../../domain/value-objects/email.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { SetupToken } from '../../../domain/value-objects/setup-token.vo';
import { UserCreatedEvent } from '../../../domain/events/user-created.domain-event';
import { EmailAlreadyExistsException } from '../../../domain/exceptions/user-domain.exception';
import { maskEmail } from '../../../../../shared/utils/mask.util';
import { CreateUserCommand } from '../create-user.command';

const SETUP_TOKEN_TTL_MS = 72 * 60 * 60 * 1_000;

interface CreateUserTxResult {
  userId: string;
  rawToken: string;
}

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_SETUP_REPOSITORY)
    private readonly setupRepo: IPasswordSetupRepository,
    @Inject(EMAIL_PORT)
    private readonly emailPort: IEmailPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly cache: CacheService,
  ) {}

  async execute(command: CreateUserCommand): Promise<string> {
    const { dto } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CreateUserHandler start', {
      traceId,
      email: maskEmail(dto.email),
    });

    const { userId, rawToken } = await this.runWrite(command);

    // Side-effects — MUST run AFTER the tx commits.
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const setupLink = `${appUrl}/users/setup-password?token=${rawToken}`;
    await this.emailPort.sendPasswordSetupLink({
      to: dto.email,
      setupLink,
      name: dto.name,
      type: 'setup',
    });

    await this.cache.delByPattern('users-service:users:list:*');
    // ACL cache key used by CaslAbilityFactory — drops the ability snapshot
    // for the just-created user so the first request sees the new grants.
    if (dto.roleIds !== undefined || dto.permissionIds !== undefined) {
      await this.cache.del(`casl:ability:${userId}`);
    }

    this.eventEmitter.emit(
      'users.created',
      new UserCreatedEvent(userId, dto.email),
    );

    this.logger.info('CreateUserHandler end', { traceId, userId });

    return userId;
  }

  @Transactional()
  private async runWrite(
    command: CreateUserCommand,
  ): Promise<CreateUserTxResult> {
    const { dto, actorId } = command;

    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new EmailAlreadyExistsException(dto.email);
    }

    const email = Email.create(dto.email);
    const user = User.create({
      id: UserId.reconstitute('00000000-0000-0000-0000-000000000000'),
      email,
      name: dto.name,
      lastName: dto.lastName ?? null,
      phone: dto.phone ?? null,
    });

    const created = await this.userRepo.create(user);

    const token = SetupToken.generate();
    const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS);
    await this.setupRepo.save({
      userId: created.id.value,
      token,
      type: 'setup',
      expiresAt,
    });

    // Role + direct-permission replacement happens INSIDE the same tx so a
    // partial write rolls everything back.
    if (dto.roleIds !== undefined) {
      await this.userRepo.replaceRoles(created.id.value, dto.roleIds, actorId);
    }
    if (dto.permissionIds !== undefined) {
      await this.userRepo.replacePermissions(
        created.id.value,
        dto.permissionIds,
        actorId,
      );
    }

    await this.audit.log(
      {
        action: 'users.created',
        resourceType: 'USER',
        resourceId: created.id.value,
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

    return { userId: created.id.value, rawToken: token.raw };
  }
}
