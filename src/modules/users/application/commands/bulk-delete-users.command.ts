export class BulkDeleteUsersCommand {
  constructor(
    public readonly ids: string[],
    public readonly actorId: string,
  ) {}
}
