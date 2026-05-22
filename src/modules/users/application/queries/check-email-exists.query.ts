export class CheckEmailExistsQuery {
  constructor(
    public readonly email: string,
    public readonly excludeId?: string,
  ) {}
}
