/**
 * Raised when a scheduled appointment is deleted (soft delete). Drives the
 * blade-style "appointment cancelled" client email (ES) and the internal
 * admin "Appointment Cancelled Alert" notice (EN).
 */
export class InspectionCancelledEvent {
  constructor(public readonly appointmentId: string) {}
}
