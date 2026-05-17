import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { CacheService } from '../../../../shared/cache/cache.service';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IPasswordSetupRepository } from '../../domain/repositories/password-setup.repository.interface';
import { PASSWORD_SETUP_REPOSITORY } from '../../domain/repositories/password-setup.repository.interface';
import type { IEmailPort } from '../../domain/ports/outbound/email.port';
import { EMAIL_PORT } from '../../domain/ports/outbound/email.port';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { SetupToken } from '../../domain/value-objects/setup-token.vo';
import { UserCreatedEvent } from '../../domain/events/user-created.domain-event';
import { EmailAlreadyExistsException } from '../../domain/exceptions/user-domain.exception';
import type { CreateUserInput } from '../dtos/create-user.dto';

const SETUP_TOKEN_TTL_MS = 72 * 60 * 60 * 1_000;

@Injectable()
export class CreateUserUseCase {
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

  @Transactional()
  async execute(dto: CreateUserInput, actorId: string): Promise<string> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('CreateUserUseCase start', { traceId, email: dto.email });

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

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const setupLink = `${appUrl}/users/setup-password?token=${token.raw}`;
    await this.emailPort.sendPasswordSetupLink({
      to: dto.email,
      setupLink,
      name: dto.name,
      type: 'setup',
    });

    await this.cache.delByPattern('users-service:users:list:*');

    this.eventEmitter.emit(
      'users.created',
      new UserCreatedEvent(created.id.value, dto.email),
    );

    await this.audit.log({
      action: 'users.created',
      resourceType: 'USER',
      resourceId: created.id.value,
      actorId,
    });

    this.logger.info('CreateUserUseCase end', {
      traceId,
      userId: created.id.value,
    });

    return created.id.value;
  }
}
