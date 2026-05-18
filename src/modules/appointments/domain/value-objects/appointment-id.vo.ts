export class AppointmentId {
  private constructor(public readonly value: string) {}

  static create(value: string): AppointmentId {
    if (!value || value.trim().length === 0) {
      throw new Error('AppointmentId cannot be empty');
    }
    return new AppointmentId(value);
  }
}
