export class BulkDeleteAppointmentsCommand {
  constructor(
    public readonly ids: string[],
    public readonly actorId: string,
  ) {}
}
