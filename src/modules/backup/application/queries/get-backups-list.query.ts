export class GetBackupsListQuery {
  constructor(
    public readonly page: number,
    public readonly limit: number,
  ) {}
}
