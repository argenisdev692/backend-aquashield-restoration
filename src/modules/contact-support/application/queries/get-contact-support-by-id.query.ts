export class GetContactSupportByIdQuery {
  constructor(
    public readonly id: string,
    /** Laravel-style — when `true`, include soft-deleted rows in the lookup. */
    public readonly withTrashed: boolean = false,
  ) {}
}
