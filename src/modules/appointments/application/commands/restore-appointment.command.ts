export class RestoreAppointmentCommand {
  constructor(
    public readonly id: string,
    public readonly actorId: string,
  ) {}
}
