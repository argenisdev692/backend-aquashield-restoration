export class BulkDeletePostsCommand {
  constructor(
    public readonly ids: string[],
    public readonly actorId: string,
  ) {}
}
