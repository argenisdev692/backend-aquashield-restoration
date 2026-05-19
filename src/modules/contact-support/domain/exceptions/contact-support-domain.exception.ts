export class ContactSupportDomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContactSupportDomainException';
  }
}
