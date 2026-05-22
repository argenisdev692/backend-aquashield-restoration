export class AppointmentsBulkRestoredEvent {
  constructor(public readonly ids: readonly string[]) {}
}
