export class GetAppointmentByIdQuery {
  constructor(
    public readonly id: string,
    /**
     * Laravel-style — when `true`, include soft-deleted (suspended)
     * appointments. Defaults to `false` (`Model::find()` behaviour).
     */
    public readonly withTrashed: boolean = false,
  ) {}
}
