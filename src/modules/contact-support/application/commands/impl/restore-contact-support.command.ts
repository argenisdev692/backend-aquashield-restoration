export class RestoreContactSupportCommand {
  constructor(
    public readonly id: string,
    public readonly actorId: string,
  ) {}
}
