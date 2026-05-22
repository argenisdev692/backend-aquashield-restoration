export class CheckUsernameExistsQuery {
  constructor(
    public readonly username: string,
    public readonly excludeId?: string,
  ) {}
}
