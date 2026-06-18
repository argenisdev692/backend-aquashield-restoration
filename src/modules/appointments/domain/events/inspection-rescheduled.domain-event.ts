/**
 * Raised when an appointment's inspection date and/or time changes on an
 * already-scheduled inspection. Carries the previous date/time so the
 * "rescheduled" email can render the before/after schedule block.
 */
export class InspectionRescheduledEvent {
  constructor(
    public readonly appointmentId: string,
    public readonly previousInspectionDate: Date | null,
    public readonly previousInspectionTime: Date | null,
  ) {}
}
