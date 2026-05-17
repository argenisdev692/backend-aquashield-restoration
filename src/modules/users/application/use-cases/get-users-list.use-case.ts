import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../logger/logger.service';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { UserReadModel } from '../read-models/user.read-model';
import type { UsersListQuery } from '../dtos/users-list-query.dto';

export interface PaginatedUsers {
  data: UserReadModel[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class GetUsersListUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(query: UsersListQuery): Promise<PaginatedUsers> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('GetUsersListUseCase', { traceId });

    const skip = (query.page - 1) * query.limit;
    const { users, total } = await this.userRepo.findAll({
      skip,
      take: query.limit,
      search: query.search,
    });

    return {
      data: users.map((user) => ({
        id: user.id.value,
        name: user.name,
        lastName: user.lastName,
        email: user.email.value,
        emailVerifiedAt: user.emailVerifiedAt,
        passwordConfirmedAt: user.passwordConfirmedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
