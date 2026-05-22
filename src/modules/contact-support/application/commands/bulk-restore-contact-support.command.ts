export class BulkRestoreContactSupportCommand {
  constructor(
    public readonly ids: string[],
    public readonly actorId: string,
  ) {}
}
