export class AppointmentDomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppointmentDomainException';
  }
}
