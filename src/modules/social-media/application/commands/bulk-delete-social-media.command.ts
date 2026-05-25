export class BulkDeleteSocialMediaCommand {
  constructor(
    public readonly ids: string[],
    public readonly actorId: string,
  ) {}
}
