import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { CacheService } from '../../../../shared/cache/cache.service';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IAuditPort } from '../../../../shared/activity-log/audit.port';
import { AUDIT_PORT } from '../../../../shared/activity-log/audit.port';
import { User } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import {
  EmailAlreadyExistsException,
  UserNotFoundException,
} from '../../domain/exceptions/user-domain.exception';
import type { UpdateUserInput } from '../dtos/update-user.dto';

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
    private readonly cache: CacheService,
  ) {}

  async execute(
    id: string,
    dto: UpdateUserInput,
    actorId: string,
  ): Promise<void> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('UpdateUserUseCase start', { traceId, userId: id });

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
      password: user.password,
      emailVerifiedAt: user.emailVerifiedAt,
      passwordConfirmedAt: user.passwordConfirmedAt,
      createdAt: user.createdAt,
      updatedAt: new Date(),
      deletedAt: user.deletedAt,
    });

    await this.userRepo.save(updated);

    await this.cache.del(`users-service:user:${id}`);
    await this.cache.delByPattern('users-service:users:list:*');

    await this.audit.log({
      action: 'users.updated',
      resourceType: 'USER',
      resourceId: id,
      actorId,
    });

    this.logger.info('UpdateUserUseCase end', { traceId, userId: id });
  }
}
