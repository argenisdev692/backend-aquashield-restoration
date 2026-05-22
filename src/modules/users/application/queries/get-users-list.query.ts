import type { UsersListQuery } from '../dtos/users-list-query.dto';

export class GetUsersListQuery {
  constructor(public readonly query: UsersListQuery) {}
}
