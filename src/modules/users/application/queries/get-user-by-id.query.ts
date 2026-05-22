export class GetUserByIdQuery {
  constructor(
    public readonly id: string,
    /**
     * Laravel-style flag — when `true`, include soft-deleted (suspended)
     * rows in the lookup. Defaults to `false` (the same behaviour as
     * `Model::find()` without `withTrashed()`).
     */
    public readonly withTrashed: boolean = false,
  ) {}
}
