export class AppointmentsBulkDeletedEvent {
  constructor(public readonly ids: readonly string[]) {}
}
