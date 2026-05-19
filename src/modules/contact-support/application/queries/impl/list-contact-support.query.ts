export class ListContactSupportQuery {
  constructor(
    public readonly page: number,
    public readonly limit: number,
    public readonly readed?: boolean,
  ) {}
}
