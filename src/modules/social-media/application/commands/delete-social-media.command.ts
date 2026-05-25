export class DeleteSocialMediaCommand {
  constructor(
    public readonly id: string,
    public readonly actorId: string,
  ) {}
}
