import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { CacheService } from '../../../../shared/cache/cache.service';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IPasswordSetupRepository } from '../../domain/repositories/password-setup.repository.interface';
import { PASSWORD_SETUP_REPOSITORY } from '../../domain/repositories/password-setup.repository.interface';
import type { IPasswordHasherPort } from '../../domain/ports/outbound/password-hasher.port';
import { PASSWORD_HASHER_PORT } from '../../domain/ports/outbound/password-hasher.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { SetupToken } from '../../domain/value-objects/setup-token.vo';
import { PasswordSetupEvent } from '../../domain/events/password-setup.domain-event';
import type { SetupPasswordInput } from '../dtos/setup-password.dto';

const INVALID_MSG = 'Invalid or expired setup token';

@Injectable()
export class SetupPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_SETUP_REPOSITORY)
    private readonly setupRepo: IPasswordSetupRepository,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: IPasswordHasherPort,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: SetupPasswordInput): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('SetupPasswordUseCase start', { traceId });

    const tokenHash = SetupToken.hashOf(dto.token);
    const tokenRow = await this.setupRepo.findValid(tokenHash);
    if (!tokenRow || tokenRow.type !== 'setup') {
      throw new UnauthorizedException(INVALID_MSG);
    }

    const user = await this.userRepo.findById(tokenRow.userId);
    if (!user) {
      throw new UnauthorizedException(INVALID_MSG);
    }

    const hashedPassword = await this.passwordHasher.hash(dto.password);
    user.setPassword(hashedPassword);
    await this.userRepo.save(user);
    await this.setupRepo.markUsed(tokenRow.id);

    await this.cache.del(`users-service:user:${user.id.value}`);
    await this.cache.delByPattern('users-service:users:list:*');

    this.eventEmitter.emit(
      'users.password_setup',
      new PasswordSetupEvent(user.id.value),
    );

    await this.audit.log({
      action: 'users.password_setup',
      resourceType: 'USER',
      resourceId: user.id.value,
    });

    this.logger.info('SetupPasswordUseCase end', {
      traceId,
      userId: user.id.value,
    });
  }
}
