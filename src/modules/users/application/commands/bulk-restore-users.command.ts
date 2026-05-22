export class BulkRestoreUsersCommand {
  constructor(
    public readonly ids: string[],
    public readonly actorId: string,
  ) {}
}
