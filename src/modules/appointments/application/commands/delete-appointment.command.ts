export class DeleteAppointmentCommand {
  constructor(
    public readonly id: string,
    public readonly actorId: string,
  ) {}
}
