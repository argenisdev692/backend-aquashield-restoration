import type { UsersListQuery } from '../dtos/users-list-query.dto';

export class ExportUsersCommand {
  constructor(
    public readonly query: UsersListQuery,
    public readonly format: 'xlsx' | 'pdf',
    public readonly actorId: string,
  ) {}
}
