import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from '../../../../../logger/logger.service';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.interface';
import type { UserReadModel } from '../../../application/read-models/user.read-model';
import { resolveTrashedMode } from '../../../../../shared/crud/trashed.util';
import { resolveDateRange } from '../../../../../shared/crud/date-range.util';
import { GetUsersListQuery } from '../get-users-list.query';

export interface PaginatedUsers {
  data: UserReadModel[];
  total: number;
  page: number;
  limit: number;
}

@QueryHandler(GetUsersListQuery)
export class GetUsersListHandler implements IQueryHandler<GetUsersListQuery> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {}

  async execute(query: GetUsersListQuery): Promise<PaginatedUsers> {
    const traceId = this.cls.get<string>('traceId');
    const trashed = resolveTrashedMode({
      withTrashed: query.query.withTrashed,
      onlyTrashed: query.query.onlyTrashed,
    });
    const range = resolveDateRange({
      start_date: query.query.start_date,
      end_date: query.query.end_date,
    });
    this.logger.info('GetUsersListHandler', { traceId, trashed, range });

    const skip = (query.query.page - 1) * query.query.limit;
    const { users, total } = await this.userRepo.findAll({
      skip,
      take: query.query.limit,
      search: query.query.search,
      trashed,
      range,
    });

    // Batched access fetch — 2 SQL total regardless of page size.
    const accessByUserId = await this.userRepo.findAccessByUserIds(
      users.map((u) => u.id.value),
    );

    return {
      data: users.map((user) => {
        const access = accessByUserId.get(user.id.value) ?? {
          roles: [],
          permissions: [],
        };
        return {
          id: user.id.value,
          name: user.name,
          lastName: user.lastName,
          username: user.username,
          email: user.email.value,
          phone: user.phone,
          emailVerifiedAt: user.emailVerifiedAt,
          passwordConfirmedAt: user.passwordConfirmedAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          deletedAt: user.deletedAt,
          roles: access.roles,
          permissions: access.permissions,
          dateOfBirth: user.dateOfBirth,
          address: user.address,
          address2: user.address2,
          zipCode: user.zipCode,
          city: user.city,
          state: user.state,
          country: user.country,
          gender: user.gender,
          profilePhotoPath: user.profilePhotoPath,
          totpEnabled: user.totpEnabled,
          mustChangePassword: user.mustChangePassword,
        };
      }),
      total,
      page: query.query.page,
      limit: query.query.limit,
    };
  }
}
