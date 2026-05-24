export class PostDomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostDomainException';
  }
}
