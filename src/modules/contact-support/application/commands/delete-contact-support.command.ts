export class DeleteContactSupportCommand {
  constructor(
    public readonly id: string,
    public readonly actorId: string,
  ) {}
}
