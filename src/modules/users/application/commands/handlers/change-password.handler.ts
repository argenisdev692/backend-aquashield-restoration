import {
  BadRequestException,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { CacheService } from '../../../../../shared/cache/cache.service';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.interface';
import type { IPasswordSetupRepository } from '../../../domain/repositories/password-setup.repository.interface';
import { PASSWORD_SETUP_REPOSITORY } from '../../../domain/repositories/password-setup.repository.interface';
import type { IPasswordHasherPort } from '../../../domain/ports/outbound/password-hasher.port';
import { PASSWORD_HASHER_PORT } from '../../../domain/ports/outbound/password-hasher.port';
import type { IAuditPort } from '../../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../../shared/activity-log/audit.port';
import { SetupToken } from '../../../domain/value-objects/setup-token.vo';
import { PasswordChangedEvent } from '../../../domain/events/password-changed.domain-event';
import type { IBreachedPasswordPort } from '../../../../../shared/security/breached-password.port';
import {
  BREACHED_PASSWORD_PORT,
  BREACHED_PASSWORD_MESSAGE,
} from '../../../../../shared/security/breached-password.port';
import { ChangePasswordCommand } from '../change-password.command';

const INVALID_MSG = 'Invalid or expired change password token';

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler
  implements ICommandHandler<ChangePasswordCommand>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_SETUP_REPOSITORY)
    private readonly setupRepo: IPasswordSetupRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: IPasswordHasherPort,
    @Inject(BREACHED_PASSWORD_PORT)
    private readonly breachedPwd: IBreachedPasswordPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly cache: CacheService,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    const { dto } = command;
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('ChangePasswordHandler start', { traceId });

    if (await this.breachedPwd.isBreached(dto.password)) {
      throw new BadRequestException(BREACHED_PASSWORD_MESSAGE);
    }

    const hashedPassword = await this.passwordHasher.hash(dto.password);
    const userId = await this.runWrite(command, hashedPassword);

    await this.cache.del(`users-service:user:${userId}`);
    await this.cache.delByPattern('users-service:users:list:*');

    this.eventEmitter.emit(
      'users.password_changed',
      new PasswordChangedEvent(userId),
    );

    this.logger.info('ChangePasswordHandler end', { traceId, userId });
  }

  @Transactional()
  private async runWrite(
    command: ChangePasswordCommand,
    hashedPassword: string,
  ): Promise<string> {
    const { dto } = command;

    const tokenHash = SetupToken.hashOf(dto.token);
    const tokenRow = await this.setupRepo.findValid(tokenHash);
    if (!tokenRow || tokenRow.type !== 'change') {
      throw new UnauthorizedException(INVALID_MSG);
    }

    const user = await this.userRepo.findById(tokenRow.userId);
    if (!user) {
      throw new UnauthorizedException(INVALID_MSG);
    }

    user.changePassword(hashedPassword);
    await this.userRepo.save(user);
    await this.setupRepo.markUsed(tokenRow.id);

    await this.audit.log(
      {
        action: 'users.password_changed',
        resourceType: 'USER',
        resourceId: user.id.value,
      },
      { strict: true },
    );

    return user.id.value;
  }
}
