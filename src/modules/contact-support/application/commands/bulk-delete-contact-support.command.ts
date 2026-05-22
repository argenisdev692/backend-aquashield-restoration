export class BulkDeleteContactSupportCommand {
  constructor(
    public readonly ids: string[],
    public readonly actorId: string,
  ) {}
}
