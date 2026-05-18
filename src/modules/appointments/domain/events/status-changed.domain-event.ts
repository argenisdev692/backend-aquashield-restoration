export class StatusChangedEvent {
  constructor(
    public readonly appointmentId: string,
    public readonly oldStatus: string | null,
    public readonly newStatus: string,
  ) {}
}
