export class MarkAppointmentReadCommand {
  constructor(
    public readonly id: string,
    public readonly actorId: string,
  ) {}
}
