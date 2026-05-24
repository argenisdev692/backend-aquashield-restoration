export class GetPostByIdQuery {
  constructor(
    public readonly id: string,
    public readonly withTrashed: boolean = false,
  ) {}
}
