import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.interface';
import type { UserReadModel } from '../../../application/read-models/user.read-model';
import { GetUserByIdQuery } from '../get-user-by-id.query';

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(query: GetUserByIdQuery): Promise<UserReadModel | null> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetUserByIdHandler', {
      traceId,
      userId: query.id,
      withTrashed: query.withTrashed,
    });

    const user = await this.userRepo.findById(query.id, query.withTrashed);
    if (!user) return null;

    const access = await this.userRepo.findAccessByUserId(user.id.value);

    return {
      id: user.id.value,
      name: user.name,
      lastName: user.lastName,
      email: user.email.value,
      phone: user.phone,
      emailVerifiedAt: user.emailVerifiedAt,
      passwordConfirmedAt: user.passwordConfirmedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      roles: access.roles,
      permissions: access.permissions,
    };
  }
}
