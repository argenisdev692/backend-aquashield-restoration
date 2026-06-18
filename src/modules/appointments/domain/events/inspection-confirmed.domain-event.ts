/**
 * Raised when an appointment's `inspectionStatus` transitions to `Confirmed`.
 * Drives the blade-style "appointment confirmed" client email (ES) and the
 * "New Appointment Confirmed" internal admin notice (EN).
 */
export class InspectionConfirmedEvent {
  constructor(public readonly appointmentId: string) {}
}
